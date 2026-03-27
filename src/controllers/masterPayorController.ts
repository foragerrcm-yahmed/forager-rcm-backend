import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Shape a raw MasterPayor DB row into the API response format.
 * Attaches enabledForOrg, orgPayorId, credentialedProviders (if requested).
 */
function shapeMasterPayor(
  mp: any,
  orgId: string,
  credentialMap?: Map<string, any[]>
) {
  const enabled = (mp.payors ?? []).some((p: any) => p.organizationId === orgId);
  const orgPayor = (mp.payors ?? []).find((p: any) => p.organizationId === orgId);
  const credentialedProviders = credentialMap?.get(mp.id) ?? [];

  return {
    id: mp.id,
    stediId: mp.stediId,
    displayName: mp.displayName,
    primaryPayorId: mp.primaryPayorId,
    aliases: mp.aliases,
    avatarUrl: mp.avatarUrl,
    coverageTypes: mp.coverageTypes,
    transactionSupport: mp.transactionSupport,
    isActive: mp.isActive,
    parentId: mp.parentId ?? null,
    // Hierarchy: children are shaped recursively (only one level deep in list)
    children: (mp.children ?? []).map((child: any) =>
      shapeMasterPayor(child, orgId, credentialMap)
    ),
    enabledForOrg: enabled,
    orgPayorId: orgPayor?.id ?? null,
    orgPayorName: orgPayor?.name ?? null,
    // Credentialing warning: providers credentialed with this payor but payor is disabled
    credentialedProviders,
    hasCredentialingWarning: !enabled && credentialedProviders.length > 0,
  };
}

// ─── List MasterPayors (hierarchical, top-level only, children nested) ────────
export const listMasterPayors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page as string,
      req.query.limit as string
    );
    const { search, flat } = req.query;
    const orgId = req.user!.organizationId;

    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { displayName: { contains: search as string, mode: 'insensitive' } },
        { primaryPayorId: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // When searching, return flat list. Otherwise return hierarchy (top-level only).
    if (!search && flat !== '1') {
      where.parentId = null; // Only top-level parents
    }

    const [masterPayors, total] = await prisma.$transaction([
      prisma.masterPayor.findMany({
        where,
        skip,
        take: limit,
        orderBy: { displayName: 'asc' },
        include: {
          payors: {
            where: { organizationId: orgId },
            select: { id: true, name: true, organizationId: true },
          },
          // Include one level of children for hierarchy
          children: {
            where: { isActive: true },
            orderBy: { displayName: 'asc' },
            include: {
              payors: {
                where: { organizationId: orgId },
                select: { id: true, name: true, organizationId: true },
              },
              children: {
                where: { isActive: true },
                orderBy: { displayName: 'asc' },
                include: {
                  payors: {
                    where: { organizationId: orgId },
                    select: { id: true, name: true, organizationId: true },
                  },
                  children: { where: { isActive: true } },
                },
              },
            },
          },
        },
      }),
      prisma.masterPayor.count({ where }),
    ]);

    // Fetch credentialing data for this org in one query
    const allMasterPayorIds = masterPayors.flatMap((mp: any) => [
      mp.id,
      ...(mp.children ?? []).flatMap((c: any) => [c.id, ...(c.children ?? []).map((gc: any) => gc.id)]),
    ]);

    const credentials = await prisma.providerCredential.findMany({
      where: {
        organizationId: orgId,
        masterPayorId: { in: allMasterPayorIds },
      },
      include: {
        provider: {
          select: { id: true, firstName: true, lastName: true, npi: true, specialty: true },
        },
      },
    });

    // Build a map: masterPayorId → [provider info]
    const credentialMap = new Map<string, any[]>();
    for (const cred of credentials) {
      const list = credentialMap.get(cred.masterPayorId) ?? [];
      list.push({
        credentialId: cred.id,
        credentialType: cred.credentialType,
        effectiveDate: cred.effectiveDate ? Number(cred.effectiveDate) : null,
        expirationDate: cred.expirationDate ? Number(cred.expirationDate) : null,
        provider: cred.provider,
      });
      credentialMap.set(cred.masterPayorId, list);
    }

    res.status(200).json({
      success: true,
      data: masterPayors.map((mp) => shapeMasterPayor(mp, orgId, credentialMap)),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    handlePrismaError(res, error, 'MASTER_PAYOR');
  }
};

// ─── Get single MasterPayor ───────────────────────────────────────────────────
export const getMasterPayor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;

    const masterPayor = await prisma.masterPayor.findUnique({
      where: { id },
      include: {
        payors: {
          where: { organizationId: orgId },
          select: { id: true, name: true, organizationId: true },
        },
        children: {
          where: { isActive: true },
          orderBy: { displayName: 'asc' },
          include: {
            payors: {
              where: { organizationId: orgId },
              select: { id: true, name: true, organizationId: true },
            },
            children: { where: { isActive: true } },
          },
        },
        parent: {
          select: { id: true, displayName: true },
        },
      },
    });

    if (!masterPayor) {
      sendError(res, 404, notFound('MASTER_PAYOR'), 'Master payor not found');
      return;
    }

    const credentials = await prisma.providerCredential.findMany({
      where: { organizationId: orgId, masterPayorId: id },
      include: {
        provider: {
          select: { id: true, firstName: true, lastName: true, npi: true, specialty: true },
        },
      },
    });

    const credentialMap = new Map<string, any[]>();
    credentialMap.set(id, credentials.map((c) => ({
      credentialId: c.id,
      credentialType: c.credentialType,
      effectiveDate: c.effectiveDate ? Number(c.effectiveDate) : null,
      expirationDate: c.expirationDate ? Number(c.expirationDate) : null,
      provider: c.provider,
    })));

    res.status(200).json({
      success: true,
      data: shapeMasterPayor(masterPayor, orgId, credentialMap),
    });
  } catch (error) {
    handlePrismaError(res, error, 'MASTER_PAYOR');
  }
};

// ─── Enable a MasterPayor for the current org ─────────────────────────────────
export const enableMasterPayorForOrg = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, payorCategory, billingTaxonomy, phone, portalUrl, address } = req.body;

    const masterPayor = await prisma.masterPayor.findUnique({ where: { id } });
    if (!masterPayor) {
      sendError(res, 404, notFound('MASTER_PAYOR'), 'Master payor not found');
      return;
    }

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

// ─── Disable a MasterPayor for the current org ────────────────────────────────
export const disableMasterPayorForOrg = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

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

// ─── Admin: Upsert a MasterPayor ──────────────────────────────────────────────
export const upsertMasterPayor = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'Admin') {
      sendError(res, 403, 'FORBIDDEN', 'Only platform admins can manage master payors');
      return;
    }

    const {
      stediId, displayName, primaryPayorId, aliases,
      avatarUrl, coverageTypes, transactionSupport, isActive, parentId,
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
        parentId: parentId ?? null,
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
        parentId: parentId ?? null,
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

// ─── ProviderCredential: List for org ─────────────────────────────────────────
export const listProviderCredentials = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const { providerId, masterPayorId } = req.query;

    const where: any = { organizationId: orgId };
    if (providerId) where.providerId = providerId;
    if (masterPayorId) where.masterPayorId = masterPayorId;

    const credentials = await prisma.providerCredential.findMany({
      where,
      include: {
        provider: { select: { id: true, firstName: true, lastName: true, npi: true, specialty: true } },
        masterPayor: { select: { id: true, displayName: true, primaryPayorId: true, transactionSupport: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: credentials.map((c) => ({
        ...c,
        effectiveDate: c.effectiveDate ? Number(c.effectiveDate) : null,
        expirationDate: c.expirationDate ? Number(c.expirationDate) : null,
        createdAt: Number(c.createdAt),
        updatedAt: Number(c.updatedAt),
      })),
    });
  } catch (error) {
    handlePrismaError(res, error, 'PROVIDER_CREDENTIAL');
  }
};

// ─── ProviderCredential: Create ───────────────────────────────────────────────
export const createProviderCredential = async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user!.organizationId;
    const { providerId, masterPayorId, credentialType, effectiveDate, expirationDate, notes } = req.body;

    if (!providerId || !masterPayorId) {
      sendError(res, 400, validationError('PROVIDER_CREDENTIAL'), 'providerId and masterPayorId are required');
      return;
    }

    // Verify provider belongs to org
    const provider = await prisma.provider.findFirst({ where: { id: providerId, organizationId: orgId } });
    if (!provider) {
      sendError(res, 404, notFound('PROVIDER'), 'Provider not found in your organization');
      return;
    }

    // Verify master payor exists
    const masterPayor = await prisma.masterPayor.findUnique({ where: { id: masterPayorId } });
    if (!masterPayor) {
      sendError(res, 404, notFound('MASTER_PAYOR'), 'Master payor not found');
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    const credential = await prisma.providerCredential.create({
      data: {
        providerId,
        masterPayorId,
        credentialType: credentialType || null,
        effectiveDate: effectiveDate ? BigInt(effectiveDate) : null,
        expirationDate: expirationDate ? BigInt(expirationDate) : null,
        notes: notes || null,
        organizationId: orgId,
        createdById: req.user!.userId,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      include: {
        provider: { select: { id: true, firstName: true, lastName: true, npi: true } },
        masterPayor: { select: { id: true, displayName: true, primaryPayorId: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...credential,
        effectiveDate: credential.effectiveDate ? Number(credential.effectiveDate) : null,
        expirationDate: credential.expirationDate ? Number(credential.expirationDate) : null,
        createdAt: Number(credential.createdAt),
        updatedAt: Number(credential.updatedAt),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'PROVIDER_CREDENTIAL');
  }
};

// ─── ProviderCredential: Delete ───────────────────────────────────────────────
export const deleteProviderCredential = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;

    const credential = await prisma.providerCredential.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!credential) {
      sendError(res, 404, notFound('PROVIDER_CREDENTIAL'), 'Credential not found');
      return;
    }

    await prisma.providerCredential.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    handlePrismaError(res, error, 'PROVIDER_CREDENTIAL');
  }
};
