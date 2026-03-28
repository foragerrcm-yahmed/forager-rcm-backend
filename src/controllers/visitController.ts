import { Request, Response } from 'express';
import { PrismaClient, DataSource } from '../../generated/prisma';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';
import * as stediService from '../services/stedi.service';

const prisma = new PrismaClient();

export const getVisits = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, patientId, providerId, status, dateFrom, dateTo, source } = req.query;

    const where: any = {
      organizationId: req.user?.organizationId,
    };

    if (search && typeof search === 'string') {
      where.OR = [
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (organizationId && typeof organizationId === 'string') {
      where.organizationId = organizationId;
    }

    if (patientId && typeof patientId === 'string') {
      where.patientId = patientId;
    }

    if (providerId && typeof providerId === 'string') {
      where.providerId = providerId;
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.visitDate = {};
      if (dateFrom) where.visitDate.gte = BigInt(dateFrom as string);
      if (dateTo) where.visitDate.lte = BigInt(dateTo as string);
    }

    if (source && typeof source === 'string') {
      where.source = source as DataSource;
    }

    const [visits, total] = await prisma.$transaction([
      prisma.visit.findMany({
        where,
        skip,
        take: limit,
        include: {
          patient: {
            select: {
              id: true, firstName: true, lastName: true,
              insurancePolicies: {
                where: { isPrimary: true },
                take: 1,
                select: {
                  id: true,
                  eligibilityChecks: {
                    orderBy: { createdAt: 'desc' as const },
                    take: 1,
                    select: { isEligible: true, coverageActive: true, errorMessage: true, createdAt: true },
                  },
                },
              },
            },
          },
          provider: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, firstName: true, lastName: true } },
          claims: { select: { id: true, claimNumber: true, status: true, billedAmount: true } },
        }
      }),
      prisma.visit.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: visits.map(v => {
        const primaryPolicy = (v.patient as any)?.insurancePolicies?.[0];
        const latestCheck = primaryPolicy?.eligibilityChecks?.[0];
        let eligibilityStatus: string = 'unchecked';
        if (latestCheck) {
          if (latestCheck.errorMessage) eligibilityStatus = 'error';
          else if (latestCheck.isEligible === true && latestCheck.coverageActive !== false) eligibilityStatus = 'passed';
          else eligibilityStatus = 'failed';
        }
        return {
          ...v,
          visitDate: Number(v.visitDate),
          visitTime: Number((v as any).visitTime),
          createdAt: Number(v.createdAt),
          updatedAt: Number(v.updatedAt),
          eligibilityStatus,
          eligibilityCheckedAt: latestCheck ? Number(new Date(latestCheck.createdAt).getTime() / 1000) : null,
        };
      }),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    handlePrismaError(res, error, 'VISIT');
  }
};

export const getVisitById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const visit = await prisma.visit.findUnique({
      where: { id: id as string, organizationId: req.user?.organizationId as string | undefined },
      include: {
        patient: {
          select: {
            id: true, firstName: true, lastName: true, dateOfBirth: true, phone: true, email: true,
            insurancePolicies: {
              include: {
                plan: {
                  include: {
                    payor: { select: { id: true, name: true, stediPayorId: true } },
                  }
                },
                // Direct payor (used when no plan is selected)
                payor: { select: { id: true, name: true, stediPayorId: true } },
                dependents: { orderBy: { createdAt: 'asc' as const } },
              }
            }
          }
        },
        provider: { select: { id: true, firstName: true, lastName: true, specialty: true, licenseType: true, taxonomyCode: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        claims: {
          include: {
            payor: { select: { id: true, name: true } },
            services: true,
          }
        },
        diagnoses: {
          orderBy: { sequence: 'asc' },
        },
      }
    });

    if (!visit) {
      sendError(res, 404, notFound('VISIT'), 'Visit not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...visit,
        visitDate: Number(visit.visitDate),
        visitTime: Number((visit as any).visitTime),
        createdAt: Number(visit.createdAt),
        updatedAt: Number(visit.updatedAt),
        patient: visit.patient ? {
          ...visit.patient,
          dateOfBirth: Number((visit.patient as any).dateOfBirth),
        } : null,
        claims: (visit as any).claims?.map((c: any) => ({
          ...c,
          billedAmount: Number(c.billedAmount),
          allowedAmount: c.allowedAmount ? Number(c.allowedAmount) : null,
          paidAmount: c.paidAmount ? Number(c.paidAmount) : null,
          serviceDate: Number(c.serviceDate),
          submissionDate: c.submissionDate ? Number(c.submissionDate) : null,
          creationDate: Number(c.creationDate),
        })),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'VISIT');
  }
};

export const createVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { patientId, providerId, organizationId, visitDate, visitTime, duration, visitType, location, status, notes, source } = req.body;

    if (!patientId || !providerId || !organizationId || !visitDate || !visitTime || duration === undefined || !visitType || !status || !source) {
      sendError(res, 400, validationError('VISIT'), 'Missing required visit fields');
      return;
    }

    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('VISIT'), 'Cannot create visits outside your organization');
      return;
    }

    const [patient, provider] = await prisma.$transaction([
      prisma.patient.findUnique({ where: { id: patientId as string } }),
      prisma.provider.findUnique({ where: { id: providerId as string } }),
    ]);

    if (!patient || patient.organizationId !== organizationId) {
      sendError(res, 404, foreignKeyError('PATIENT'), 'Patient not found');
      return;
    }

    if (!provider || provider.organizationId !== organizationId) {
      sendError(res, 404, foreignKeyError('PROVIDER'), 'Provider not found');
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    const visit = await prisma.visit.create({
      data: {
        patient: { connect: { id: patientId as string } },
        provider: { connect: { id: providerId as string } },
        organization: { connect: { id: organizationId as string } },
        visitDate: BigInt(visitDate),
        visitTime: BigInt(visitTime),
        duration,
        visitType,
        location,
        status,
        notes,
        source,
        createdBy: { connect: { id: req.user!.userId } },
        updatedBy: { connect: { id: req.user!.userId } },
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...visit,
        visitDate: Number(visit.visitDate),
        createdAt: Number(visit.createdAt),
        updatedAt: Number(visit.updatedAt),
      },
    });

    // Auto-trigger eligibility check when a visit is created with Upcoming status
    // Fire-and-forget: does not block the response
    if (status === 'Upcoming') {
      setImmediate(async () => {
        try {
          // Fetch patient's primary insurance
          const primaryInsurance = await prisma.patientInsurance.findFirst({
            where: { patientId: patientId as string, isPrimary: true },
            include: {
              plan: { include: { payor: true } },
            },
          });
          if (!primaryInsurance) return;

          // Check if we should recheck eligibility using the shouldRecheckEligibility logic
          const lastCheck = await prisma.eligibilityCheck.findFirst({
            where: { patientInsuranceId: primaryInsurance.id },
            orderBy: { createdAt: 'desc' },
          });

          // Adapt lastCheck.createdAt (Date) to the bigint shape expected by shouldRecheckEligibility
          const lastCheckAdapted = lastCheck
            ? { createdAt: BigInt(Math.floor(lastCheck.createdAt.getTime() / 1000)) }
            : null;

          const shouldRecheck = shouldRecheckEligibility(
            { visitDate: BigInt(visitDate), visitType } as any,
            lastCheckAdapted,
            primaryInsurance.planYearStartMonth ?? 1
          );

          if (!shouldRecheck) return;

          await stediService.checkEligibility(primaryInsurance.id, organizationId as string, visit.id);
        } catch (e) {
          // Log but do not fail — eligibility check is best-effort
          console.error('[auto-eligibility] Error during auto-check for visit', visit.id, e);
        }
      });
    }
  } catch (error) {
    handlePrismaError(res, error, 'VISIT');
  }
};

export const updateVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { visitDate, visitType, location, status, notes, source } = req.body;
    const now = Math.floor(Date.now() / 1000);

    const existingVisit = await prisma.visit.findUnique({ where: { id: id as string } });
    if (!existingVisit || existingVisit.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('VISIT'), 'Cannot update visits outside your organization or visit not found');
      return;
    }

    const visit = await prisma.visit.update({
      where: { id: id as string },
      data: {
        visitDate: visitDate ? BigInt(visitDate) : undefined,
        visitType,
        location,
        status,
        notes,
        source,
        updatedBy: { connect: { id: req.user!.userId } },
        updatedAt: BigInt(now),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...visit,
        visitDate: Number(visit.visitDate),
        createdAt: Number(visit.createdAt),
        updatedAt: Number(visit.updatedAt),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'VISIT');
  }
};

export const deleteVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingVisit = await prisma.visit.findUnique({ where: { id: id as string } });
    if (!existingVisit || existingVisit.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('VISIT'), 'Cannot delete visits outside your organization or visit not found');
      return;
    }

    const claimCount = await prisma.claim.count({ where: { visitId: id as string } });
    if (claimCount > 0) {
      sendError(res, 409, deleteFailed('VISIT'), 'Visit has dependent claims and cannot be deleted');
      return;
    }

    await prisma.visit.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    handlePrismaError(res, error, 'VISIT');
  }
};

// ─── Eligibility Recheck Logic ───────────────────────────────────────────────
// Determines whether a new eligibility check should be triggered for a visit.
// This is the canonical implementation of the shouldRecheckEligibility function.

function differenceInDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function crossesPlanYearReset(lastCheckDate: Date, appointmentDate: Date, planYearStartMonth: number = 1): boolean {
  // planYearStartMonth: 1 = January (calendar year), 7 = July, etc.
  // A "plan year" runs from planYearStartMonth of year N through planYearStartMonth-1 of year N+1.
  // We check whether lastCheckDate and appointmentDate fall in different plan years.
  const planYearOf = (d: Date): number => {
    const month = d.getMonth() + 1; // 1-12
    const year = d.getFullYear();
    // If we're before the start month, we're still in the previous plan year
    return month >= planYearStartMonth ? year : year - 1;
  };
  return planYearOf(lastCheckDate) !== planYearOf(appointmentDate);
}

function isTherapyVisit(visit: { visitType: string }): boolean {
  // PT, OT, SLP, and mental health visits have per-visit benefit limits that
  // change with every claim — always recheck.
  const therapyTypes = ['PhysicalTherapy', 'OccupationalTherapy', 'SpeechTherapy', 'MentalHealth', 'BehavioralHealth'];
  return therapyTypes.includes(visit.visitType);
}

export function shouldRecheckEligibility(
  visit: { visitDate: bigint; visitType: string },
  lastCheck: { createdAt: bigint } | null,
  planYearStartMonth: number = 1  // 1-12; default January (calendar year)
): boolean {
  if (!lastCheck) return true;

  const appointmentDate = new Date(Number(visit.visitDate) * 1000);
  const lastCheckDate = new Date(Number(lastCheck.createdAt) * 1000);
  const today = new Date();

  const daysSinceCheck = differenceInDays(today, lastCheckDate);
  const daysUntilAppointment = differenceInDays(appointmentDate, today);

  // Always recheck if appointment crosses a plan year boundary
  if (crossesPlanYearReset(lastCheckDate, appointmentDate, planYearStartMonth)) return true;

  // Always recheck PT/rehab — therapy visit counts change with every claim
  if (isTherapyVisit({ visitType: visit.visitType })) return true;

  // If appointment is today or tomorrow and checked within 3 days — skip
  if (daysUntilAppointment <= 1 && daysSinceCheck <= 3) return false;

  // If checked within 3 days of the appointment date — skip
  if (daysSinceCheck <= 3) return false;

  // Otherwise recheck
  return true;
}
