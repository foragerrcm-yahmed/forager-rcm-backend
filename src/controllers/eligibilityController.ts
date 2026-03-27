import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { checkEligibility } from '../services/stedi.service';
import { StediError } from '../services/stedi.service';

const prisma = new PrismaClient();

/**
 * POST /api/eligibility/check
 * Trigger a real-time eligibility check (270/271) for a patient insurance record.
 * Body: { patientInsuranceId, visitId? }
 */
export async function runEligibilityCheck(req: Request, res: Response): Promise<void> {
  try {
    const { patientInsuranceId, visitId } = req.body;
    const organizationId = (req as any).user?.organizationId;

    if (!patientInsuranceId) {
      res.status(400).json({ error: 'patientInsuranceId is required' });
      return;
    }

    if (!organizationId) {
      res.status(401).json({ error: 'Organization context is required' });
      return;
    }

    const result = await checkEligibility(patientInsuranceId, organizationId, visitId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (e: any) {
    if (e instanceof StediError) {
      res.status(e.statusCode).json({
        error: e.code,
        message: e.message,
        raw: e.raw,
      });
    } else {
      console.error('Eligibility check error:', e);
      res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
    }
  }
}

/**
 * GET /api/eligibility
 * List eligibility checks for the org, optionally filtered by patientId or visitId.
 * Query: { patientId?, visitId?, limit?, offset? }
 */
export async function getEligibilityChecks(req: Request, res: Response): Promise<void> {
  try {
    const organizationId = (req as any).user?.organizationId;
    const { patientId, visitId, patientInsuranceId, limit = '20', offset = '0' } = req.query;

    const where: any = { organizationId };
    if (patientId) where.patientId = patientId as string;
    if (visitId) where.visitId = visitId as string;
    if (patientInsuranceId) where.patientInsuranceId = patientInsuranceId as string;

    const [items, total] = await Promise.all([
      prisma.eligibilityCheck.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
          patientInsurance: {
            include: {
              plan: {
                include: {
                  payor: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.eligibilityCheck.count({ where }),
    ]);

    res.status(200).json({ data: items, total, limit: parseInt(limit as string), offset: parseInt(offset as string) });
  } catch (e: any) {
    console.error('Get eligibility checks error:', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
  }
}

/**
 * GET /api/eligibility/:id
 * Get a single eligibility check by ID.
 */
export async function getEligibilityCheckById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    const check = await prisma.eligibilityCheck.findFirst({
      where: { id, organizationId },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true } },
        patientInsurance: {
          include: {
            plan: {
              include: {
                payor: true,
              },
            },
          },
        },
      },
    });

    if (!check) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Eligibility check not found' });
      return;
    }

    res.status(200).json({ data: check });
  } catch (e: any) {
    console.error('Get eligibility check error:', e);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
  }
}
