import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';

const prisma = new PrismaClient();

export const getCPTCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, specialty } = req.query;

    const where: any = {
      organizationId: req.user?.organizationId,
    };

    if (search && typeof search === 'string') {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (organizationId && typeof organizationId === 'string') {
      where.organizationId = organizationId;
    }

    if (specialty && typeof specialty === 'string') {
      where.specialty = { contains: specialty, mode: 'insensitive' };
    }

    const [cptCodes, total] = await prisma.$transaction([
      prisma.cPTCode.findMany({
        where,
        skip,
        take: limit,
      }),
      prisma.cPTCode.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: cptCodes.map(c => ({
        ...c,
        createdAt: Number(c.createdAt),
        updatedAt: Number(c.updatedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get CPT codes error:', error);
    sendError(res, 500, 'CPT_CODE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const getCPTCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const cptCode = await prisma.cPTCode.findUnique({
      where: { id: id as string, organizationId: req.user?.organizationId as string | undefined },
    });

    if (!cptCode) {
      sendError(res, 404, notFound('CPT_CODE'), 'CPT code not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...cptCode,
        createdAt: Number(cptCode.createdAt),
        updatedAt: Number(cptCode.updatedAt),
      },
    });
  } catch (error) {
    console.error('Get CPT code by ID error:', error);
    sendError(res, 500, 'CPT_CODE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const createCPTCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, description, specialty, basePrice, organizationId } = req.body;

    if (!code || !description || basePrice === undefined || !organizationId) {
      sendError(res, 400, validationError('CPT_CODE'), 'Missing required CPT code fields');
      return;
    }

    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('CPT_CODE'), 'Cannot create CPT codes outside your organization');
      return;
    }

    const existingCode = await prisma.cPTCode.findFirst({ where: { code, organizationId: organizationId as string } });
    if (existingCode) {
      sendError(res, 409, duplicate('CPT_CODE'), 'CPT code already exists in this organization');
      return;
    }

    if (basePrice < 0) {
      sendError(res, 400, validationError('CPT_CODE'), 'Base price must be positive');
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    const cptCode = await prisma.cPTCode.create({
      data: {
        code,
        description,
        specialty,
        basePrice,
        organization: { connect: { id: organizationId as string } },
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...cptCode,
        createdAt: Number(cptCode.createdAt),
        updatedAt: Number(cptCode.updatedAt),
      },
    });
  } catch (error) {
    console.error('Create CPT code error:', error);
    sendError(res, 500, 'CPT_CODE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const updateCPTCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, description, specialty, basePrice } = req.body;
    const now = Math.floor(Date.now() / 1000);

    const existingCode = await prisma.cPTCode.findUnique({ where: { id: id as string } });
    if (!existingCode || existingCode.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('CPT_CODE'), 'Cannot update CPT codes outside your organization or code not found');
      return;
    }

    if (code && code !== existingCode.code) {
      const duplicateCode = await prisma.cPTCode.findFirst({ where: { code, organizationId: existingCode.organizationId } });
      if (duplicateCode) {
        sendError(res, 409, duplicate('CPT_CODE'), 'CPT code already exists in this organization');
        return;
      }
    }

    if (basePrice !== undefined && basePrice < 0) {
      sendError(res, 400, validationError('CPT_CODE'), 'Base price must be positive');
      return;
    }

    const cptCode = await prisma.cPTCode.update({
      where: { id: id as string },
      data: {
        code,
        description,
        specialty,
        basePrice,
        updatedAt: BigInt(now),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        ...cptCode,
        createdAt: Number(cptCode.createdAt),
        updatedAt: Number(cptCode.updatedAt),
      },
    });
  } catch (error) {
    console.error('Update CPT code error:', error);
    sendError(res, 500, 'CPT_CODE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const deleteCPTCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingCode = await prisma.cPTCode.findUnique({ where: { id: id as string } });
    if (!existingCode || existingCode.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('CPT_CODE'), 'Cannot delete CPT codes outside your organization or code not found');
      return;
    }

    const serviceCount = await prisma.claimService.count({ where: { cptCode: id as string } });
    if (serviceCount > 0) {
      sendError(res, 409, deleteFailed('CPT_CODE'), 'CPT code is used in claim services and cannot be deleted');
      return;
    }

    await prisma.cPTCode.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete CPT code error:', error);
    sendError(res, 500, 'CPT_CODE_INTERNAL_ERROR', 'Internal server error');
  }
};
