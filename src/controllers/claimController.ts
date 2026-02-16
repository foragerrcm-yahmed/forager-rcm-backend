import { Request, Response } from 'express';
import { PrismaClient, DataSource } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';

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
      data: claims.map(c => ({
        ...c,
        serviceDate: Number(c.serviceDate),
        submissionDate: c.submissionDate ? Number(c.submissionDate) : null,
        createdAt: Number(c.createdAt),
        updatedAt: Number(c.updatedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get claims error:', error);
    sendError(res, 500, 'CLAIM_INTERNAL_ERROR', 'Internal server error');
  }
};

export const getClaimById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const claim = await prisma.claim.findUnique({
      where: { id: id as string, organizationId: req.user?.organizationId as string | undefined },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        services: true,
        timeline: true,
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
        createdAt: Number(claim.createdAt),
        updatedAt: Number(claim.updatedAt),
      },
    });
  } catch (error) {
    console.error('Get claim by ID error:', error);
    sendError(res, 500, 'CLAIM_INTERNAL_ERROR', 'Internal server error');
  }
};

export const createClaim = async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimNumber, patientId, providerId, payorId, organizationId, visitId, serviceDate, billedAmount, paidAmount, status, notes, source, submissionDate, services } = req.body;

    if (!claimNumber || !patientId || !providerId || !payorId || !organizationId || !serviceDate || billedAmount === undefined || !status || !source || !services || services.length === 0) {
      sendError(res, 400, validationError('CLAIM'), 'Missing required claim fields or services');
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
        services: {
          create: services.map((s: any) => ({
            cptCode: s.cptCode,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            totalPrice: s.totalPrice,
            createdAt: BigInt(now),
            updatedAt: BigInt(now),
          })),
        },
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
    console.error('Create claim error:', error);
    sendError(res, 500, 'CLAIM_INTERNAL_ERROR', 'Internal server error');
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
          create: services.map((s: any) => ({
            cptCode: s.cptCode,
            quantity: s.quantity,
            unitPrice: s.unitPrice,
            totalPrice: s.totalPrice,
            createdAt: BigInt(now),
            updatedAt: BigInt(now),
          })),
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
    console.error('Update claim error:', error);
    sendError(res, 500, 'CLAIM_INTERNAL_ERROR', 'Internal server error');
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
    console.error('Update claim status error:', error);
    sendError(res, 500, 'CLAIM_INTERNAL_ERROR', 'Internal server error');
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
    console.error('Delete claim error:', error);
    sendError(res, 500, 'CLAIM_INTERNAL_ERROR', 'Internal server error');
  }
};
