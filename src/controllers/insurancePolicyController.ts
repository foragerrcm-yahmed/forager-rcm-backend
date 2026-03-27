import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';

const prisma = new PrismaClient();

// ─── Shared include ───────────────────────────────────────────────────────────

const POLICY_INCLUDE = {
  plan: {
    include: {
      payor: { select: { id: true, name: true, stediPayorId: true } },
    },
  },
  dependents: {
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

// ─── Serialiser: convert BigInt fields to Number for JSON ────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validate and normalise a raw dependent from the request body.
 * dateOfBirth is accepted as a Unix timestamp (number/string) — same convention
 * as Patient.dateOfBirth.  Returns null if the entry is invalid.
 */
function parseDependent(raw: any, index: number): {
  firstName: string;
  lastName: string;
  dateOfBirth?: bigint;
  relationship?: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const firstName = (raw.firstName ?? '').trim();
  const lastName  = (raw.lastName  ?? '').trim();
  if (!firstName || !lastName) return null;

  let dateOfBirth: bigint | undefined;
  if (raw.dateOfBirth != null && raw.dateOfBirth !== '') {
    const ts = Number(raw.dateOfBirth);
    if (!isNaN(ts)) dateOfBirth = BigInt(Math.floor(ts));
  }

  return {
    firstName,
    lastName,
    ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
    ...(raw.relationship ? { relationship: String(raw.relationship) } : {}),
  };
}

// ─── List ─────────────────────────────────────────────────────────────────────

export const getInsurancePolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page as string,
      req.query.limit as string,
    );
    const { patientId, payorId, isPrimary } = req.query;

    const where: any = {};
    if (patientId && typeof patientId === 'string') where.patientId = patientId;
    if (payorId   && typeof payorId   === 'string') where.plan = { payor: { id: payorId } };
    if (isPrimary !== undefined) where.isPrimary = isPrimary === 'true';

    const [policies, total] = await prisma.$transaction([
      prisma.patientInsurance.findMany({ where, skip, take: limit, include: POLICY_INCLUDE }),
      prisma.patientInsurance.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: policies.map(serializePolicy),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_POLICY');
  }
};

// ─── Get by ID ────────────────────────────────────────────────────────────────

export const getInsurancePolicyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const policy = await prisma.patientInsurance.findUnique({
      where: { id },
      include: POLICY_INCLUDE,
    });

    if (!policy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    res.status(200).json({ success: true, data: serializePolicy(policy) });
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_POLICY');
  }
};

// ─── Create ───────────────────────────────────────────────────────────────────

export const createInsurancePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      patientId, planId, isPrimary, insuredType,
      subscriberName, subscriberDob, memberId,
      dependents: rawDependents,
    } = req.body;

    const now = BigInt(Math.floor(Date.now() / 1000));

    if (!patientId || !planId || isPrimary === undefined || !insuredType || !memberId) {
      sendError(
        res, 400, validationError('INSURANCE_POLICY'),
        'Missing required fields: patientId, planId, isPrimary, insuredType, memberId',
      );
      return;
    }

    const [patient, plan] = await Promise.all([
      prisma.patient.findUnique({ where: { id: patientId } }),
      prisma.payorPlan.findUnique({ where: { id: planId } }),
    ]);
    if (!patient) { sendError(res, 404, notFound('PATIENT'), 'Patient not found'); return; }
    if (!plan)    { sendError(res, 404, notFound('PAYOR_PLAN'), 'Payor plan not found'); return; }

    // Parse dependents array (ignore malformed entries)
    const parsedDependents = Array.isArray(rawDependents)
      ? rawDependents.map(parseDependent).filter(Boolean) as any[]
      : [];

    const policy = await prisma.patientInsurance.create({
      data: {
        patient:      { connect: { id: patientId } },
        plan:         { connect: { id: planId } },
        isPrimary,
        insuredType,
        subscriberName:  subscriberName ?? null,
        subscriberDob:   subscriberDob != null ? BigInt(Math.floor(Number(subscriberDob))) : undefined,
        memberId,
        createdAt: now,
        updatedAt: now,
        dependents: parsedDependents.length > 0
          ? {
              create: parsedDependents.map(d => ({
                ...d,
                createdAt: now,
                updatedAt: now,
              })),
            }
          : undefined,
      },
      include: POLICY_INCLUDE,
    });

    res.status(201).json({ success: true, data: serializePolicy(policy) });
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_POLICY');
  }
};

// ─── Update ───────────────────────────────────────────────────────────────────
// Dependents are replaced wholesale when provided.
// If `dependents` key is absent from the body, existing dependents are untouched.
// If `dependents` is an empty array, all dependents are removed.

export const updateInsurancePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      isPrimary, insuredType, subscriberName, subscriberDob,
      memberId, planId, dependents: rawDependents,
    } = req.body;

    const now = BigInt(Math.floor(Date.now() / 1000));

    const existing = await prisma.patientInsurance.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    // Build dependents mutation only if the key was explicitly sent
    let dependentsMutation: any = undefined;
    if ('dependents' in req.body) {
      const parsed = Array.isArray(rawDependents)
        ? rawDependents.map(parseDependent).filter(Boolean) as any[]
        : [];

      dependentsMutation = {
        // Delete all existing dependents then recreate
        deleteMany: {},
        create: parsed.map(d => ({ ...d, createdAt: now, updatedAt: now })),
      };
    }

    const policy = await prisma.patientInsurance.update({
      where: { id },
      data: {
        ...(isPrimary    !== undefined ? { isPrimary }    : {}),
        ...(insuredType  !== undefined ? { insuredType }  : {}),
        ...(subscriberName !== undefined ? { subscriberName } : {}),
        ...(subscriberDob  != null
          ? { subscriberDob: BigInt(Math.floor(Number(subscriberDob))) }
          : subscriberDob === null ? { subscriberDob: null } : {}),
        ...(memberId !== undefined ? { memberId } : {}),
        ...(planId   !== undefined ? { plan: { connect: { id: planId } } } : {}),
        ...(dependentsMutation ? { dependents: dependentsMutation } : {}),
        updatedAt: now,
      },
      include: POLICY_INCLUDE,
    });

    res.status(200).json({ success: true, data: serializePolicy(policy) });
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_POLICY');
  }
};

// ─── Delete ───────────────────────────────────────────────────────────────────

export const deleteInsurancePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.patientInsurance.findUnique({ where: { id } });
    if (!existing) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }
    await prisma.patientInsurance.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    handlePrismaError(res, error, 'INSURANCE_POLICY');
  }
};
