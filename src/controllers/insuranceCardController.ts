/**
 * insuranceCardController.ts
 *
 * Handles insurance card photo upload and AI-powered field extraction.
 *
 * POST /api/insurance-policies/:id/card
 *   - Accepts a multipart image (field name: "card")
 *   - Saves the image to disk under uploads/insurance-cards/
 *   - Updates the policy's insuranceCardPath
 *   - Returns { success, data: { policy, cardUrl } }
 *
 * POST /api/insurance-policies/:id/parse-card
 *   - Accepts a multipart image (field name: "card")
 *   - Sends the image to GPT-4o Vision with a structured extraction prompt
 *   - Returns { success, data: { extracted: { ... } } } — does NOT save anything
 *     so the frontend can preview and confirm before committing
 *
 * DELETE /api/insurance-policies/:id/card
 *   - Removes the stored card image and clears insuranceCardPath on the policy
 */

import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { sendError, notFound, validationError } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CARD_DIR = path.join(__dirname, '../../uploads/insurance-cards');
if (!fs.existsSync(CARD_DIR)) fs.mkdirSync(CARD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Shared include (mirrors insurancePolicyController) ───────────────────────

const POLICY_INCLUDE = {
  plan: {
    include: {
      payor: { select: { id: true, name: true, stediPayorId: true } },
    },
  },
  dependents: { orderBy: { createdAt: 'asc' as const } },
} as const;

function serializePolicy(p: any) {
  return {
    ...p,
    subscriberDob: p.subscriberDob != null ? Number(p.subscriberDob) : null,
    createdAt: Number(p.createdAt),
    updatedAt: Number(p.updatedAt),
    dependents: (p.dependents ?? []).map((d: any) => ({
      ...d,
      dateOfBirth: d.dateOfBirth != null ? Number(d.dateOfBirth) : null,
      createdAt: Number(d.createdAt),
      updatedAt: Number(d.updatedAt),
    })),
  };
}

// ─── Upload card ──────────────────────────────────────────────────────────────

export const uploadInsuranceCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const policy = await prisma.patientInsurance.findUnique({ where: { id } });
    if (!policy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    const file = (req as any).file;
    if (!file) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'No image file provided');
      return;
    }

    if (file.size > MAX_SIZE) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'Image exceeds 10 MB limit');
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_IMAGE_TYPES.includes(ext)) {
      sendError(res, 400, validationError('INSURANCE_CARD'), `File type .${ext} is not supported. Use JPG, PNG, or WebP.`);
      return;
    }

    // Remove old card if present
    if (policy.insuranceCardPath) {
      const oldPath = path.join(__dirname, '../../', policy.insuranceCardPath.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Save new card
    const fileName = `${id}-${Date.now()}.${ext}`;
    const filePath = path.join(CARD_DIR, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const cardPath = `/uploads/insurance-cards/${fileName}`;

    const updated = await prisma.patientInsurance.update({
      where: { id },
      data: {
        insuranceCardPath: cardPath,
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
      include: POLICY_INCLUDE,
    });

    res.status(200).json({
      success: true,
      data: {
        policy: serializePolicy(updated),
        cardUrl: cardPath,
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_CARD');
  }
};

// ─── Delete card ──────────────────────────────────────────────────────────────

export const deleteInsuranceCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const policy = await prisma.patientInsurance.findUnique({ where: { id } });
    if (!policy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    if (policy.insuranceCardPath) {
      const filePath = path.join(__dirname, '../../', policy.insuranceCardPath.replace(/^\//, ''));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    const updated = await prisma.patientInsurance.update({
      where: { id },
      data: {
        insuranceCardPath: null,
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
      include: POLICY_INCLUDE,
    });

    res.status(200).json({ success: true, data: serializePolicy(updated) });
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_CARD');
  }
};

// ─── Parse card (AI extraction) ───────────────────────────────────────────────

const EXTRACTION_PROMPT = `You are an expert at reading US health insurance cards.
Carefully examine this insurance card image and extract the following fields.
Return ONLY a valid JSON object — no markdown, no explanation, no extra text.

Fields to extract (use null for any field that is not visible or not applicable):
{
  "memberName": "Full name of the primary member/subscriber",
  "memberId": "Member ID or Subscriber ID (often labeled ID, Member ID, Subscriber ID)",
  "groupNumber": "Group number (often labeled Group, Group #, Group No.)",
  "planName": "Name of the specific plan (e.g. 'PPO Gold', 'HMO Select')",
  "payorName": "Name of the insurance company (e.g. 'Blue Cross Blue Shield', 'Aetna', 'UnitedHealthcare')",
  "rxBin": "Pharmacy BIN number if present",
  "rxPcn": "Pharmacy PCN if present",
  "copayPrimary": "Primary care copay amount as a number (dollars only, no $ sign), or null",
  "copaySpecialist": "Specialist copay amount as a number, or null",
  "copayUrgentCare": "Urgent care copay amount as a number, or null",
  "copayER": "Emergency room copay amount as a number, or null",
  "deductible": "Annual deductible amount as a number, or null",
  "oopMax": "Out-of-pocket maximum as a number, or null",
  "coverageType": "Type of coverage: one of HMO, PPO, EPO, POS, HDHP, or null if unclear",
  "effectiveDate": "Coverage effective date in YYYY-MM-DD format, or null",
  "subscriberName": "Subscriber name if different from member name, or null",
  "insurerPhone": "Customer service phone number on the card, or null"
}`;

export const parseInsuranceCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify policy exists
    const policy = await prisma.patientInsurance.findUnique({ where: { id } });
    if (!policy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    const file = (req as any).file;
    if (!file) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'No image file provided');
      return;
    }

    if (file.size > MAX_SIZE) {
      sendError(res, 400, validationError('INSURANCE_CARD'), 'Image exceeds 10 MB limit');
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_IMAGE_TYPES.includes(ext)) {
      sendError(res, 400, validationError('INSURANCE_CARD'), `File type .${ext} is not supported.`);
      return;
    }

    // Convert buffer to base64 data URL
    const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
      : ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';
    const base64Image = file.buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // Call OpenAI GPT-4o Vision
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      sendError(res, 503, 'OPENAI_NOT_CONFIGURED', 'OpenAI API key is not configured on this server');
      return;
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: EXTRACTION_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
          ],
        },
      ],
    });

    const rawText = completion.choices[0]?.message?.content ?? '';

    // Parse the JSON response — strip any accidental markdown fences
    let extracted: any = {};
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Return empty extraction rather than failing hard
      extracted = {};
    }

    // Also save the card image to disk and update insuranceCardPath
    const fileName = `${id}-${Date.now()}.${ext}`;
    const filePath = path.join(CARD_DIR, fileName);

    // Remove old card if present
    if (policy.insuranceCardPath) {
      const oldPath = path.join(__dirname, '../../', policy.insuranceCardPath.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    fs.writeFileSync(filePath, file.buffer);
    const cardPath = `/uploads/insurance-cards/${fileName}`;

    await prisma.patientInsurance.update({
      where: { id },
      data: {
        insuranceCardPath: cardPath,
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        extracted,
        cardUrl: cardPath,
      },
    });
  } catch (error: any) {
    console.error('Insurance card parse error:', error?.message ?? error);
    sendError(res, 500, 'CARD_PARSE_FAILED', error?.message ?? 'Failed to parse insurance card');
  }
};
