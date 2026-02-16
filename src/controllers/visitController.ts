import { Request, Response } from 'express';
import { PrismaClient, DataSource } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';

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
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, firstName: true, lastName: true } },
        }
      }),
      prisma.visit.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: visits.map(v => ({
        ...v,
        visitDate: Number(v.visitDate),
        createdAt: Number(v.createdAt),
        updatedAt: Number(v.updatedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get visits error:', error);
    sendError(res, 500, 'VISIT_INTERNAL_ERROR', 'Internal server error');
  }
};

export const getVisitById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const visit = await prisma.visit.findUnique({
      where: { id: id as string, organizationId: req.user?.organizationId as string | undefined },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
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
        createdAt: Number(visit.createdAt),
        updatedAt: Number(visit.updatedAt),
      },
    });
  } catch (error) {
    console.error('Get visit by ID error:', error);
    sendError(res, 500, 'VISIT_INTERNAL_ERROR', 'Internal server error');
  }
};

export const createVisit = async (req: Request, res: Response): Promise<void> => {
  try {
    const { patientId, providerId, organizationId, visitDate, visitType, location, status, notes, source } = req.body;

    if (!patientId || !providerId || !organizationId || !visitDate || !visitType || !status || !source) {
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
  } catch (error) {
    console.error('Create visit error:', error);
    sendError(res, 500, 'VISIT_INTERNAL_ERROR', 'Internal server error');
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
    console.error('Update visit error:', error);
    sendError(res, 500, 'VISIT_INTERNAL_ERROR', 'Internal server error');
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
    console.error('Delete visit error:', error);
    sendError(res, 500, 'VISIT_INTERNAL_ERROR', 'Internal server error');
  }
};
