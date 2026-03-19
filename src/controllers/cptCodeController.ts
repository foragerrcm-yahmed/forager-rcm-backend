import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';

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
    handlePrismaError(res, error, 'CPT_CODE');
  }
};

export const getCPTCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const cptCode = await prisma.cPTCode.findUnique({
      where: { code: id as string },
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
    handlePrismaError(res, error, 'CPT_CODE');
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
        standardPrice: basePrice || 0,
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
    handlePrismaError(res, error, 'CPT_CODE');
  }
};

export const updateCPTCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, description, specialty, basePrice } = req.body;
    const now = Math.floor(Date.now() / 1000);

    const existingCode = await prisma.cPTCode.findUnique({ where: { code: id as string } });
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
      where: { code: id as string },
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
    handlePrismaError(res, error, 'CPT_CODE');
  }
};

export const deleteCPTCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingCode = await prisma.cPTCode.findUnique({ where: { code: id as string } });
    if (!existingCode || existingCode.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('CPT_CODE'), 'Cannot delete CPT codes outside your organization or code not found');
      return;
    }

    const serviceCount = await prisma.claimService.count({ where: { cptCodeCode: id as string } });
    if (serviceCount > 0) {
      sendError(res, 409, deleteFailed('CPT_CODE'), 'CPT code is used in claim services and cannot be deleted');
      return;
    }

    await prisma.cPTCode.delete({ where: { code: id as string } });
    res.status(204).send();
  } catch (error) {
    handlePrismaError(res, error, 'CPT_CODE');
  }
};

// ─── CPT Code Rate Tiers ─────────────────────────────────────────────────────
// Provider-taxonomy-specific rate overrides per CPT code.

/**
 * GET /api/cpt-codes/:id/rates
 * List all rate tiers for a CPT code in the org.
 */
export const getCPTCodeRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = req.user?.organizationId;

    const rates = await prisma.cPTCodeRate.findMany({
      where: { cptCodeCode: id as string, organizationId },
      orderBy: { taxonomyLabel: 'asc' },
    });

    res.status(200).json({
      success: true,
      data: rates.map(r => ({
        ...r,
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
      })),
    });
  } catch (error) {
    handlePrismaError(res, error, 'CPT_CODE_RATE');
  }
};

/**
 * POST /api/cpt-codes/:id/rates
 * Create a rate tier for a CPT code.
 * Body: { taxonomyCode, taxonomyLabel?, standardPrice, contractedPrice?, notes? }
 */
export const createCPTCodeRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { taxonomyCode, taxonomyLabel, standardPrice, contractedPrice, notes } = req.body;
    const organizationId = req.user?.organizationId;

    if (!taxonomyCode || standardPrice === undefined) {
      sendError(res, 400, validationError('CPT_CODE_RATE'), 'taxonomyCode and standardPrice are required');
      return;
    }

    // Verify CPT code belongs to org
    const cptCode = await prisma.cPTCode.findFirst({
      where: { code: id as string, organizationId },
    });
    if (!cptCode) {
      sendError(res, 404, notFound('CPT_CODE'), 'CPT code not found in your organization');
      return;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));

    const rate = await prisma.cPTCodeRate.create({
      data: {
        cptCodeCode: id as string,
        taxonomyCode,
        taxonomyLabel: taxonomyLabel ?? null,
        standardPrice,
        contractedPrice: contractedPrice ?? null,
        notes: notes ?? null,
        organizationId: organizationId as string,
        createdAt: now,
        updatedAt: now,
      },
    });

    res.status(201).json({
      success: true,
      data: { ...rate, createdAt: Number(rate.createdAt), updatedAt: Number(rate.updatedAt) },
    });
  } catch (error) {
    handlePrismaError(res, error, 'CPT_CODE_RATE');
  }
};

/**
 * PUT /api/cpt-codes/:id/rates/:rateId
 * Update a rate tier.
 */
export const updateCPTCodeRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateId } = req.params;
    const { taxonomyLabel, standardPrice, contractedPrice, notes } = req.body;
    const organizationId = req.user?.organizationId;

    const existing = await prisma.cPTCodeRate.findFirst({
      where: { id: rateId, organizationId },
    });
    if (!existing) {
      sendError(res, 404, notFound('CPT_CODE_RATE'), 'Rate tier not found');
      return;
    }

    const now = BigInt(Math.floor(Date.now() / 1000));

    const rate = await prisma.cPTCodeRate.update({
      where: { id: rateId },
      data: {
        taxonomyLabel: taxonomyLabel ?? existing.taxonomyLabel,
        standardPrice: standardPrice ?? existing.standardPrice,
        contractedPrice: contractedPrice !== undefined ? contractedPrice : existing.contractedPrice,
        notes: notes !== undefined ? notes : existing.notes,
        updatedAt: now,
      },
    });

    res.status(200).json({
      success: true,
      data: { ...rate, createdAt: Number(rate.createdAt), updatedAt: Number(rate.updatedAt) },
    });
  } catch (error) {
    handlePrismaError(res, error, 'CPT_CODE_RATE');
  }
};

/**
 * DELETE /api/cpt-codes/:id/rates/:rateId
 * Delete a rate tier.
 */
export const deleteCPTCodeRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rateId } = req.params;
    const organizationId = req.user?.organizationId;

    const existing = await prisma.cPTCodeRate.findFirst({
      where: { id: rateId, organizationId },
    });
    if (!existing) {
      sendError(res, 404, notFound('CPT_CODE_RATE'), 'Rate tier not found');
      return;
    }

    await prisma.cPTCodeRate.delete({ where: { id: rateId } });
    res.status(204).send();
  } catch (error) {
    handlePrismaError(res, error, 'CPT_CODE_RATE');
  }
};
