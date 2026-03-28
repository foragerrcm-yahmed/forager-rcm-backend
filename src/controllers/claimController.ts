import { Request, Response } from 'express';
import { PrismaClient, DataSource } from '../../generated/prisma';
import { applyClaimStatusRecalculation, recalculateClaimStatus } from '../services/claimStatusService';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';
import { convertBigIntToNumber } from '../utils/bigint';

const prisma = new PrismaClient();

export const getClaims = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, patientId, providerId, payorId, status, dateFrom, dateTo, amountMin, amountMax, source, includeServices, includeTimeline } = req.query;

    const where: any = {
      organizationId: req.user?.organizationId,
    };

    if (search && typeof search === 'string') {
      where.OR = [
        { claimNumber: { contains: search, mode: 'insensitive' } },
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

    if (payorId && typeof payorId === 'string') {
      where.payorId = payorId;
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.serviceDate = {};
      if (dateFrom) where.serviceDate.gte = BigInt(dateFrom as string);
      if (dateTo) where.serviceDate.lte = BigInt(dateTo as string);
    }

    if (amountMin || amountMax) {
      where.billedAmount = {};
      if (amountMin) where.billedAmount.gte = parseFloat(amountMin as string);
      if (amountMax) where.billedAmount.lte = parseFloat(amountMax as string);
    }

    if (source && typeof source === 'string') {
      where.source = source as DataSource;
    }

    const include: any = {
      patient: { select: { id: true, firstName: true, lastName: true } },
      provider: { select: { id: true, firstName: true, lastName: true } },
      payor: { select: { id: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      updatedBy: { select: { id: true, firstName: true, lastName: true } },
    };

    if (includeServices === 'true') {
      include.services = true;
    }

    if (includeTimeline === 'true') {
      include.timeline = true;
    }

    const [claims, total] = await prisma.$transaction([
      prisma.claim.findMany({
        where,
        skip,
        take: limit,
        include,
      }),
      prisma.claim.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: convertBigIntToNumber(claims),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    handlePrismaError(res, error, 'CLAIM');
  }
};

export const getClaimById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const claim = await prisma.claim.findUnique({
      where: { id: id as string, organizationId: req.user?.organizationId as string | undefined },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true, phone: true, email: true } },
        provider: { select: { id: true, firstName: true, lastName: true, specialty: true, taxonomyCode: true } },
        payor: { select: { id: true, name: true } },
        visit: {
          select: {
            id: true, visitDate: true, visitType: true, location: true, status: true,
            diagnoses: { orderBy: { sequence: 'asc' } },
          }
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        services: true,
        timeline: true,
        diagnoses: { orderBy: { sequence: 'asc' } },
      }
    });

    if (!claim) {
      sendError(res, 404, notFound('CLAIM'), 'Claim not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...claim,
        serviceDate: Number(claim.serviceDate),
        submissionDate: claim.submissionDate ? Number(claim.submissionDate) : null,
        creationDate: Number(claim.creationDate),
        createdAt: Number(claim.createdAt),
        updatedAt: Number(claim.updatedAt),
        billedAmount: Number(claim.billedAmount),
        allowedAmount: claim.allowedAmount ? Number(claim.allowedAmount) : null,
        paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
        adjustmentAmount: claim.adjustmentAmount ? Number(claim.adjustmentAmount) : null,
        patientResponsibility: claim.patientResponsibility ? Number(claim.patientResponsibility) : null,
        patient: claim.patient ? {
          ...claim.patient,
          dateOfBirth: Number((claim.patient as any).dateOfBirth),
        } : null,
        visit: claim.visit ? {
          ...claim.visit,
          visitDate: Number(claim.visit.visitDate),
        } : null,
        services: (claim as any).services?.map((s: any) => ({
          ...s,
          unitPrice: Number(s.unitPrice),
          totalPrice: Number(s.totalPrice),
          contractedRate: s.contractedRate ? Number(s.contractedRate) : null,
          createdAt: Number(s.createdAt),
        })),
        timeline: (claim as any).timeline?.map((t: any) => ({
          ...t,
          createdAt: Number(t.createdAt),
        })),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'CLAIM');
  }
};

export const createClaim = async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimNumber, patientId, providerId, payorId, organizationId, visitId, serviceDate, billedAmount, paidAmount, status, notes, source, submissionDate, services } = req.body;

    if (!claimNumber || !patientId || !providerId || !payorId || !organizationId || !serviceDate || billedAmount === undefined || !status || !source) {
      sendError(res, 400, validationError('CLAIM'), 'Missing required claim fields');
      return;
    }

    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('CLAIM'), 'Cannot create claims outside your organization');
      return;
    }

    const existingClaim = await prisma.claim.findFirst({ where: { claimNumber, organizationId: organizationId as string } });
    if (existingClaim) {
      sendError(res, 409, duplicate('CLAIM'), 'Claim with this number already exists in this organization');
      return;
    }

    const [patient, provider, payor] = await prisma.$transaction([
      prisma.patient.findUnique({ where: { id: patientId as string } }),
      prisma.provider.findUnique({ where: { id: providerId as string } }),
      prisma.payor.findUnique({ where: { id: payorId as string } }),
    ]);

    if (!patient || patient.organizationId !== organizationId) {
      sendError(res, 404, foreignKeyError('PATIENT'), 'Patient not found');
      return;
    }

    if (!provider || provider.organizationId !== organizationId) {
      sendError(res, 404, foreignKeyError('PROVIDER'), 'Provider not found');
      return;
    }

    if (!payor || payor.organizationId !== organizationId) {
      sendError(res, 404, foreignKeyError('PAYOR'), 'Payor not found');
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    const claim = await prisma.claim.create({
      data: {
        claimNumber,
        patient: { connect: { id: patientId as string } },
        provider: { connect: { id: providerId as string } },
        payor: { connect: { id: payorId as string } },
        organization: { connect: { id: organizationId as string } },
        visit: visitId ? { connect: { id: visitId as string } } : undefined,
        serviceDate: BigInt(serviceDate),
        billedAmount,
        paidAmount: paidAmount || 0,
        status,
        notes,
        source,
        submissionDate: submissionDate ? BigInt(submissionDate) : null,
        createdBy: { connect: { id: req.user!.userId } },
        updatedBy: { connect: { id: req.user!.userId } },
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
        ...(services && services.length > 0 ? {
          services: {
            create: services.map((s: any) => {
              // Accept both cptCode and cptCodeCode from the frontend
              const cptCodeVal = s.cptCode || s.cptCodeCode || null;
              return {
                ...(cptCodeVal ? { cptCode: { connect: { code: cptCodeVal } } } : {}),
                description: s.description || null,
                quantity: s.quantity,
                unitPrice: s.unitPrice,
                totalPrice: s.totalPrice,
                contractedRate: s.contractedRate != null ? s.contractedRate : null,
                createdAt: BigInt(now),
              };
            }),
          },
        } : {}),

        timeline: {
          create: [{
            action: 'Created',
            status,
            notes: `Claim created with status: ${status}`,
            createdAt: BigInt(now),
          }],
        },
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        services: true,
        timeline: true,
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...claim,
        serviceDate: Number(claim.serviceDate),
        submissionDate: claim.submissionDate ? Number(claim.submissionDate) : null,
        createdAt: Number(claim.createdAt),
        updatedAt: Number(claim.updatedAt),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'CLAIM');
  }
};

export const updateClaim = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { serviceDate, billedAmount, paidAmount, status, notes, source, submissionDate, services } = req.body;
    const now = Math.floor(Date.now() / 1000);

    const existingClaim = await prisma.claim.findUnique({ where: { id: id as string } });
    if (!existingClaim || existingClaim.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('CLAIM'), 'Cannot update claims outside your organization or claim not found');
      return;
    }

    if (services) {
      await prisma.claimService.deleteMany({ where: { claimId: id as string } });
    }

    const claim = await prisma.claim.update({
      where: { id: id as string },
      data: {
        serviceDate: serviceDate ? BigInt(serviceDate) : undefined,
        billedAmount,
        paidAmount,
        status,
        notes,
        source,
        submissionDate: submissionDate ? BigInt(submissionDate) : undefined,
        updatedBy: { connect: { id: req.user!.userId } },
        updatedAt: BigInt(now),
        services: services ? {
          create: services.map((s: any) => {
            const cptCodeVal = s.cptCode || s.cptCodeCode || null;
            return {
              ...(cptCodeVal ? { cptCode: { connect: { code: cptCodeVal } } } : {}),
              description: s.description || null,
              quantity: s.quantity,
              unitPrice: s.unitPrice,
              totalPrice: s.totalPrice,
              contractedRate: s.contractedRate != null ? s.contractedRate : null,
              createdAt: BigInt(now),
            };
          }),
        } : undefined,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        services: true,
        timeline: true,
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...claim,
        serviceDate: Number(claim.serviceDate),
        submissionDate: claim.submissionDate ? Number(claim.submissionDate) : null,
        createdAt: Number(claim.createdAt),
        updatedAt: Number(claim.updatedAt),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'CLAIM');
  }
};

export const updateClaimStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const now = Math.floor(Date.now() / 1000);

    if (!status) {
      sendError(res, 400, validationError('CLAIM'), 'Status is required');
      return;
    }

    const existingClaim = await prisma.claim.findUnique({ where: { id: id as string } });
    if (!existingClaim || existingClaim.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('CLAIM'), 'Cannot update claims outside your organization or claim not found');
      return;
    }

    const claim = await prisma.claim.update({
      where: { id: id as string },
      data: {
        status,
        updatedBy: { connect: { id: req.user!.userId } },
        updatedAt: BigInt(now),
        timeline: {
          create: {
            action: 'Status Updated',
            status,
            notes: notes || `Status updated to: ${status}`,
            createdAt: BigInt(now),
          },
        },
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        services: true,
        timeline: true,
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...claim,
        serviceDate: Number(claim.serviceDate),
        submissionDate: claim.submissionDate ? Number(claim.submissionDate) : null,
        createdAt: Number(claim.createdAt),
        updatedAt: Number(claim.updatedAt),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'CLAIM');
  }
};

/**
 * POST /claims/:id/payment
 * Post a patient payment against a claim and recalculate its status.
 * Body: { amount: number, paymentMethod?: string, notes?: string }
 */
export const postPatientPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, notes } = req.body;
    const now = Math.floor(Date.now() / 1000);

    if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
      sendError(res, 400, validationError('CLAIM'), 'A positive payment amount is required');
      return;
    }

    const existingClaim = await prisma.claim.findUnique({
      where: { id: id as string },
      include: { payor: { select: { payorCategory: true } } },
    });
    if (!existingClaim || existingClaim.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('CLAIM'), 'Claim not found or outside your organization');
      return;
    }

    // Create a PaymentPosting record for the patient payment
    await prisma.paymentPosting.create({
      data: {
        claimId: id as string,
        organizationId: req.user!.organizationId as string,
        payerName: 'Patient',
        billedAmount: existingClaim.billedAmount,
        paidAmount: Number(amount),
        isAutoPosted: false,
        postedById: req.user!.userId,
        postedAt: new Date(),
      },
    });

    // Recalculate and persist the new claim status
    const newStatus = await applyClaimStatusRecalculation(
      id as string,
      req.user!.userId,
      now
    );

    // Add a timeline entry
    await prisma.claimTimeline.create({
      data: {
        claimId: id as string,
        action: 'Patient Payment Posted',
        notes: `$${Number(amount).toFixed(2)} received from patient${notes ? ` — ${notes}` : ''}. Status updated to ${newStatus}.`,
        status: newStatus,
        createdAt: BigInt(now),
        userId: req.user!.userId,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        claimId: id,
        amountPosted: Number(amount),
        newStatus,
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'CLAIM');
  }
};

/**
 * DELETE /claims/:id/payment/:paymentId
 * Delete a payment posting and recalculate the claim status.
 */
export const deletePaymentPosting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, paymentId } = req.params;
    const now = Math.floor(Date.now() / 1000);

    // Verify the posting belongs to this claim and org
    const posting = await prisma.paymentPosting.findUnique({
      where: { id: paymentId },
    });
    if (!posting || posting.claimId !== id || posting.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 404, notFound('PAYMENT_POSTING'), 'Payment posting not found');
      return;
    }

    await prisma.paymentPosting.delete({ where: { id: paymentId } });

    // Recalculate claim status now that this payment is removed
    const newStatus = await applyClaimStatusRecalculation(
      id,
      req.user!.userId,
      now
    );

    // Timeline entry
    await prisma.claimTimeline.create({
      data: {
        claimId: id,
        action: 'Payment Deleted',
        notes: `Payment of $${Number(posting.paidAmount).toFixed(2)} from ${posting.payerName ?? 'unknown'} was removed. Status recalculated to ${newStatus}.`,
        status: newStatus ?? undefined,
        createdAt: BigInt(now),
        userId: req.user!.userId,
      },
    });

    res.status(200).json({
      success: true,
      data: { claimId: id, deletedPaymentId: paymentId, newStatus },
    });
  } catch (error) {
    handlePrismaError(res, error, 'PAYMENT_POSTING');
  }
};

export const deleteClaim = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingClaim = await prisma.claim.findUnique({ where: { id: id as string } });
    if (!existingClaim || existingClaim.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('CLAIM'), 'Cannot delete claims outside your organization or claim not found');
      return;
    }

    await prisma.claim.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    handlePrismaError(res, error, 'CLAIM');
  }
};
