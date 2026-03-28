/**
 * insuranceCardController.ts
 *
 * Handles insurance card photo upload and field extraction using
 * Tesseract.js OCR (free, no external API keys required).
 *
 * POST /api/insurance-policies/:id/card
 *   - Accepts a multipart image (field name: "card")
 *   - Saves the image to disk under uploads/insurance-cards/
 *   - Updates the policy's insuranceCardPath
 *   - Returns { success, data: { policy, cardUrl } }
 *
 * POST /api/insurance-policies/:id/parse-card
 *   - Accepts a multipart image (field name: "card")
 *   - Runs Tesseract.js OCR on the image
 *   - Applies regex patterns to extract insurance card fields
 *   - Saves the image and updates insuranceCardPath
 *   - Returns { success, data: { extracted, cardUrl, rawText } }
 *
 * DELETE /api/insurance-policies/:id/card
 *   - Removes the stored card image and clears insuranceCardPath
 */

import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { sendError, notFound, validationError } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';
import { createWorker } from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const CARD_DIR = path.join(__dirname, '../../uploads/insurance-cards');
if (!fs.existsSync(CARD_DIR)) fs.mkdirSync(CARD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

// ─── Shared policy include ────────────────────────────────────────────────────

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

// ─── OCR ─────────────────────────────────────────────────────────────────────

async function runOCR(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker('eng', 1, {
    logger: () => {}, // suppress verbose logging
  });
  try {
    const { data } = await worker.recognize(imageBuffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

// ─── Known payor name fragments ───────────────────────────────────────────────

const KNOWN_PAYORS: Array<[RegExp, string]> = [
  [/blue\s*cross\s*blue\s*shield|bcbs/i, 'Blue Cross Blue Shield'],
  [/blue\s*cross(?!\s*blue)/i, 'Blue Cross'],
  [/blue\s*shield(?!\s*of)/i, 'Blue Shield'],
  [/aetna/i, 'Aetna'],
  [/united\s*health(?:care)?/i, 'UnitedHealthcare'],
  [/cigna/i, 'Cigna'],
  [/humana/i, 'Humana'],
  [/kaiser\s*permanente/i, 'Kaiser Permanente'],
  [/kaiser/i, 'Kaiser'],
  [/anthem/i, 'Anthem'],
  [/molina/i, 'Molina Healthcare'],
  [/centene/i, 'Centene'],
  [/wellcare/i, 'WellCare'],
  [/coventry/i, 'Coventry'],
  [/magellan/i, 'Magellan Health'],
  [/oscar\s*health/i, 'Oscar Health'],
  [/bright\s*health/i, 'Bright Health'],
  [/ambetter/i, 'Ambetter'],
  [/\bmedicaid\b/i, 'Medicaid'],
  [/\bmedicare\b/i, 'Medicare'],
  [/tricare/i, 'TRICARE'],
  [/champva/i, 'CHAMPVA'],
];

// ─── Field extraction ─────────────────────────────────────────────────────────

/**
 * Parse a dollar amount string that may contain commas (e.g. "1,500" → 1500).
 */
function parseDollar(s: string): number | null {
  const cleaned = s.replace(/,/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Find the value that follows a label on the same line or the next line.
 * Returns null if not found.
 */
function findAfterLabel(fullText: string, lines: string[], labelPattern: RegExp): string | null {
  // Wrap the label pattern in a non-capturing group so that alternations
  // (e.g. /a|b|c/) don't bleed into the separator + value part of the regex.
  const wrapped = new RegExp('(?:' + labelPattern.source + ')', 'i');
  const combined = new RegExp(
    wrapped.source + '[:\\s#\\.]+([A-Z0-9][\\w\\-/ ]{1,50})',
    'i'
  );
  const m = combined.exec(fullText);
  if (m && m[1]) return m[1].trim();

  // Next-line: label on one line, value on the next
  for (let i = 0; i < lines.length - 1; i++) {
    if (labelPattern.test(lines[i]) && lines[i].length < 40) {
      const next = lines[i + 1];
      if (next && /[A-Z0-9]/i.test(next)) return next;
    }
  }
  return null;
}

/**
 * Find a dollar amount that follows a label on the same line.
 * Handles values like $25, $1,500, 1500.00
 * Uses a specific separator pattern (colon/space) rather than a greedy
 * [^\n] so the dollar sign is not consumed before the capture group.
 */
function findDollarAmount(fullText: string, labelPattern: RegExp): number | null {
  // Wrap alternations in non-capturing group
  const wrapped = new RegExp('(?:' + labelPattern.source + ')', 'i');
  const combined = new RegExp(
    wrapped.source + '[:\\s]+\\$?\\s*([\\d,]+(?:\\.\\d{2})?)',
    'i'
  );
  const m = combined.exec(fullText);
  if (m && m[1]) return parseDollar(m[1]);
  return null;
}

export function extractFields(text: string): Record<string, any> {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const fullText = text;

  const result: Record<string, any> = {
    memberName: null,
    memberId: null,
    groupNumber: null,
    planName: null,
    payorName: null,
    rxBin: null,
    rxPcn: null,
    copayPrimary: null,
    copaySpecialist: null,
    copayUrgentCare: null,
    copayER: null,
    deductible: null,
    oopMax: null,
    coverageType: null,
    effectiveDate: null,
    subscriberName: null,
    insurerPhone: null,
  };

  // ── Member ID ─────────────────────────────────────────────────────────────
  // Strict: must be alphanumeric, 6-20 chars, no spaces
  const memberIdRaw = findAfterLabel(fullText, lines, /\bmember\s*id\b|\bsubscriber\s*id\b|\bid\s*number\b|\bmember\s*#\b/i);
  if (memberIdRaw) {
    const token = memberIdRaw.split(/\s+/)[0].replace(/[^A-Z0-9\-]/gi, '');
    if (token.length >= 4) result.memberId = token;
  }

  // ── Group Number ──────────────────────────────────────────────────────────
  const groupRaw = findAfterLabel(fullText, lines, /\bgroup\s*(?:no\.?|number|#|num\.?)\b/i);
  if (groupRaw) {
    const token = groupRaw.split(/\s+/)[0].replace(/[^A-Z0-9\-]/gi, '');
    if (token.length >= 3) result.groupNumber = token;
  }

  // ── Member / Subscriber Name ──────────────────────────────────────────────
  // Only accept values that look like a real name (letters + spaces, no digits)
  const nameRaw = findAfterLabel(fullText, lines, /\bmember\s*name\b|\bsubscriber\s*name\b|\binsured\s*name\b|\bpatient\s*name\b/i);
  if (nameRaw) {
    const cleaned = nameRaw.replace(/[^A-Za-z\s\-'\.]/g, '').trim();
    if (cleaned.length >= 3 && /[A-Za-z]{2}/.test(cleaned)) {
      result.memberName = cleaned;
    }
  }

  // ── Plan Name ─────────────────────────────────────────────────────────────
  // Look for "Plan Name:" or "Plan:" followed by a short descriptive string
  const planMatch = /(?:plan\s*name|plan\s*type|product\s*name)[:\s]+([A-Za-z0-9][A-Za-z0-9 \-+]{2,40})/i.exec(fullText);
  if (planMatch && planMatch[1]) {
    result.planName = planMatch[1].trim();
  }

  // ── Coverage Type ─────────────────────────────────────────────────────────
  const coverageMatch = /\b(PPO|HMO|EPO|POS|HDHP|HSA|FSA)\b/.exec(fullText);
  if (coverageMatch) result.coverageType = coverageMatch[1].toUpperCase();

  // ── Payor Name ────────────────────────────────────────────────────────────
  for (const [pattern, name] of KNOWN_PAYORS) {
    if (pattern.test(fullText)) {
      result.payorName = name;
      break;
    }
  }

  // ── RX BIN ────────────────────────────────────────────────────────────────
  // BIN is always exactly 6 digits
  const rxBinMatch = /(?:rx[\s\-]*)?bin[:\s#]+(\d{6})/i.exec(fullText);
  if (rxBinMatch) result.rxBin = rxBinMatch[1];

  // ── RX PCN ────────────────────────────────────────────────────────────────
  const rxPcnMatch = /\bpcn[:\s]+([A-Z0-9]{3,12})/i.exec(fullText);
  if (rxPcnMatch) result.rxPcn = rxPcnMatch[1];

  // ── Copays ────────────────────────────────────────────────────────────────
  result.copayPrimary = findDollarAmount(fullText, /\b(?:primary\s*care|pcp|office\s*visit)\b/i)
    ?? findDollarAmount(fullText, /\bcopay\b/i);
  result.copaySpecialist = findDollarAmount(fullText, /\bspecialist\b/i);
  result.copayUrgentCare = findDollarAmount(fullText, /\burgent\s*care\b/i);
  result.copayER = findDollarAmount(fullText, /\b(?:emergency\s*room|er\s*copay|emergency\s*care)\b/i);

  // ── Deductible ────────────────────────────────────────────────────────────
  result.deductible = findDollarAmount(fullText, /\bdeductible\b/i);

  // ── Out-of-Pocket Max ─────────────────────────────────────────────────────
  result.oopMax = findDollarAmount(fullText, /\bout[\s\-]*of[\s\-]*pocket\s*(?:max(?:imum)?)?|\boop\s*max\b/i);

  // ── Effective Date ────────────────────────────────────────────────────────
  // Use full phrase patterns to avoid "effective" matching before "Date:"
  const dateMatch = /(?:effective\s+date|eff\.?\s*date|coverage\s*date)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i.exec(fullText);
  if (dateMatch && dateMatch[1]) {
    const parts = dateMatch[1].split(/[\/\-]/);
    if (parts.length === 3) {
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      result.effectiveDate = `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
  }

  // ── Phone Number ─────────────────────────────────────────────────────────
  const phoneMatch = /(?:1[\s\-]?)?\(?\d{3}\)?[\s\-\.]\d{3}[\s\-\.]\d{4}/.exec(fullText);
  if (phoneMatch) result.insurerPhone = phoneMatch[0].trim();

  return result;
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

// ─── Parse card (Tesseract OCR + regex extraction) ────────────────────────────

export const parseInsuranceCard = async (req: Request, res: Response): Promise<void> => {
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
      sendError(res, 400, validationError('INSURANCE_CARD'), `File type .${ext} is not supported.`);
      return;
    }

    // Run Tesseract OCR
    const rawText = await runOCR(file.buffer);

    // Extract structured fields from OCR text
    const extracted = extractFields(rawText);

    // Save the card image to disk
    if (policy.insuranceCardPath) {
      const oldPath = path.join(__dirname, '../../', policy.insuranceCardPath.replace(/^\//, ''));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const fileName = `${id}-${Date.now()}.${ext}`;
    const filePath = path.join(CARD_DIR, fileName);
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
        rawText, // included so the frontend can show it for debugging/review
      },
    });
  } catch (error: any) {
    console.error('Insurance card parse error:', error?.message ?? error);
    sendError(res, 500, 'CARD_PARSE_FAILED', error?.message ?? 'Failed to parse insurance card');
  }
};
