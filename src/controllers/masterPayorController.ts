import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';

const prisma = new PrismaClient();

// ─── List all active MasterPayors (platform-wide, no org filter) ─────────────
export const listMasterPayors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page as string,
      req.query.limit as string
    );
    const { search } = req.query;

    const where: any = { isActive: true };

    if (search) {
      const q = String(search).toLowerCase();
      // Search by displayName or primaryPayorId or aliases (JSON contains)
      where.OR = [
        { displayName: { contains: search as string, mode: 'insensitive' } },
        { primaryPayorId: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [masterPayors, total] = await prisma.$transaction([
      prisma.masterPayor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { displayName: 'asc' },
        select: {
          id: true,
          stediId: true,
          displayName: true,
          primaryPayorId: true,
          aliases: true,
          avatarUrl: true,
          coverageTypes: true,
          transactionSupport: true,
          isActive: true,
          // Include whether this org has already enabled this master payor
          payors: {
            where: { organizationId: req.user!.organizationId },
            select: { id: true, name: true },
          },
        },
      }),
      prisma.masterPayor.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: masterPayors.map((mp) => ({
        ...mp,
        enabledForOrg: mp.payors.length > 0,
        orgPayorId: mp.payors[0]?.id ?? null,
        orgPayorName: mp.payors[0]?.name ?? null,
        payors: undefined, // strip internal join
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    handlePrismaError(res, error, 'MASTER_PAYOR');
  }
};

// ─── Get single MasterPayor by ID ────────────────────────────────────────────
export const getMasterPayor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const masterPayor = await prisma.masterPayor.findUnique({
      where: { id },
      include: {
        payors: {
          where: { organizationId: req.user!.organizationId },
          select: { id: true, name: true },
        },
      },
    });

    if (!masterPayor) {
      sendError(res, 404, notFound('MASTER_PAYOR'), 'Master payor not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...masterPayor,
        enabledForOrg: masterPayor.payors.length > 0,
        orgPayorId: masterPayor.payors[0]?.id ?? null,
        orgPayorName: masterPayor.payors[0]?.name ?? null,
        payors: undefined,
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'MASTER_PAYOR');
  }
};

// ─── Enable a MasterPayor for the current org ─────────────────────────────────
// Creates a Payor record linked to the MasterPayor. Clients never set stediId.
export const enableMasterPayorForOrg = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // MasterPayor id
    const { name, payorCategory, billingTaxonomy, phone, portalUrl, address } = req.body;

    const masterPayor = await prisma.masterPayor.findUnique({ where: { id } });
    if (!masterPayor) {
      sendError(res, 404, notFound('MASTER_PAYOR'), 'Master payor not found');
      return;
    }

    // Check if already enabled for this org
    const existing = await prisma.payor.findFirst({
      where: { masterPayorId: id, organizationId: req.user!.organizationId },
    });
    if (existing) {
      sendError(res, 409, duplicate('PAYOR'), 'This payor is already enabled for your organization');
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    const payor = await prisma.payor.create({
      data: {
        name: name || masterPayor.displayName,
        // Use primaryPayorId as the externalPayorId — org never sets this manually
        externalPayorId: `${masterPayor.primaryPayorId}_${req.user!.organizationId}`,
        payorCategory: payorCategory || 'Insurance',
        billingTaxonomy: billingTaxonomy || '',
        phone: phone || null,
        portalUrl: portalUrl || null,
        address: address || null,
        masterPayorId: id,
        organizationId: req.user!.organizationId,
        createdById: req.user!.userId,
        updatedById: req.user!.userId,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      include: {
        masterPayor: {
          select: {
            id: true,
            stediId: true,
            displayName: true,
            primaryPayorId: true,
            transactionSupport: true,
            avatarUrl: true,
          },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...payor,
        createdAt: Number(payor.createdAt),
        updatedAt: Number(payor.updatedAt),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'PAYOR');
  }
};

// ─── Disable (remove) a MasterPayor from the current org ─────────────────────
// Deletes the org's Payor record. Only allowed if no claims reference it.
export const disableMasterPayorForOrg = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // MasterPayor id

    const payor = await prisma.payor.findFirst({
      where: { masterPayorId: id, organizationId: req.user!.organizationId },
    });

    if (!payor) {
      sendError(res, 404, notFound('PAYOR'), 'This payor is not enabled for your organization');
      return;
    }

    const claimCount = await prisma.claim.count({ where: { payorId: payor.id } });
    if (claimCount > 0) {
      sendError(
        res, 409, 'PAYOR_HAS_CLAIMS',
        `Cannot remove payor: ${claimCount} claim(s) reference it. Reassign claims first.`
      );
      return;
    }

    await prisma.payor.delete({ where: { id: payor.id } });
    res.status(204).send();
  } catch (error) {
    handlePrismaError(res, error, 'PAYOR');
  }
};

// ─── Admin: Upsert a MasterPayor (platform admin only) ───────────────────────
// Used by the seed script and future Stedi sync job.
export const upsertMasterPayor = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'Admin') {
      sendError(res, 403, 'FORBIDDEN', 'Only platform admins can manage master payors');
      return;
    }

    const {
      stediId, displayName, primaryPayorId, aliases,
      avatarUrl, coverageTypes, transactionSupport, isActive,
    } = req.body;

    if (!stediId || !displayName || !primaryPayorId) {
      sendError(res, 400, validationError('MASTER_PAYOR'), 'stediId, displayName, and primaryPayorId are required');
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    const masterPayor = await prisma.masterPayor.upsert({
      where: { stediId },
      create: {
        stediId,
        displayName,
        primaryPayorId,
        aliases: aliases ?? [],
        avatarUrl: avatarUrl ?? null,
        coverageTypes: coverageTypes ?? [],
        transactionSupport: transactionSupport ?? {},
        isActive: isActive ?? true,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      update: {
        displayName,
        primaryPayorId,
        aliases: aliases ?? [],
        avatarUrl: avatarUrl ?? null,
        coverageTypes: coverageTypes ?? [],
        transactionSupport: transactionSupport ?? {},
        isActive: isActive ?? true,
        updatedAt: BigInt(now),
      },
    });

    res.status(200).json({
      success: true,
      data: {
        ...masterPayor,
        createdAt: Number(masterPayor.createdAt),
        updatedAt: Number(masterPayor.updatedAt),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'MASTER_PAYOR');
  }
};
