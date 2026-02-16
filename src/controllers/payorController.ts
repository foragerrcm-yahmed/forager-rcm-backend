import { Request, Response } from 'express';
import { PrismaClient, PlanType } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';

const prisma = new PrismaClient();

// Get all payors
export const getPayors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, payorCategory } = req.query;

    const where: any = {
      organizationId: req.user?.organizationId, // Only payors within the authenticated user's organization
    };

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { externalPayorId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (organizationId && typeof organizationId === 'string') {
      where.organizationId = organizationId;
    }

    if (payorCategory && typeof payorCategory === 'string') {
      where.payorCategory = { contains: payorCategory, mode: 'insensitive' };
    }

    const [payors, total] = await prisma.$transaction([
      prisma.payor.findMany({
        where,
        skip,
        take: limit,
        include: {
          createdBy: {
            select: { id: true, firstName: true, lastName: true }
          },
          updatedBy: {
            select: { id: true, firstName: true, lastName: true }
          },
          plans: true,
        }
      }),
      prisma.payor.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: payors.map(payor => ({
        ...payor,
        createdAt: Number(payor.createdAt),
        updatedAt: Number(payor.updatedAt),
        plans: payor.plans.map(plan => ({
          ...plan,
          createdAt: Number(plan.createdAt),
          updatedAt: Number(plan.updatedAt),
        }))
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get payors error:', error);
    sendError(res, 500, 'PAYOR_INTERNAL_ERROR', 'Internal server error');
  }
};

// Get payor by ID
export const getPayorById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const payor = await prisma.payor.findUnique({
      where: { id: id as string, organizationId: req.user?.organizationId as string | undefined },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        plans: true,
      }
    });

    if (!payor) {
      sendError(res, 404, notFound('PAYOR'), 'Payor not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...payor,
        createdAt: Number(payor.createdAt),
        updatedAt: Number(payor.updatedAt),
        plans: payor.plans.map(plan => ({
          ...plan,
          createdAt: Number(plan.createdAt),
          updatedAt: Number(plan.updatedAt),
        }))
      },
    });
  } catch (error) {
    console.error('Get payor by ID error:', error);
    sendError(res, 500, 'PAYOR_INTERNAL_ERROR', 'Internal server error');
  }
};

// Create a new payor
export const createPayor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, externalPayorId, payorCategory, billingTaxonomy, address, phone, portalUrl, organizationId, plans } = req.body;

    // Basic validation
    if (!name || !externalPayorId || !payorCategory || !billingTaxonomy || !organizationId || !plans || plans.length === 0) {
      sendError(res, 400, validationError('PAYOR'), 'Missing required payor fields or plans');
      return;
    }

    // Ensure user is creating within their own organization
    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('PAYOR'), 'Cannot create payors outside your organization');
      return;
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({ where: { id: organizationId as string } });
    if (!organization) {
      sendError(res, 404, foreignKeyError('ORGANIZATION'), 'Organization not found');
      return;
    }

    // Check for duplicate externalPayorId within the organization
    const existingPayor = await prisma.payor.findFirst({ where: { externalPayorId, organizationId: organizationId as string } });
    if (existingPayor) {
      sendError(res, 409, duplicate('PAYOR'), 'Payor with this externalPayorId already exists in this organization');
      return;
    }

    // Validate plans
    for (const plan of plans) {
      if (!plan.planName || !plan.planType || typeof plan.isInNetwork !== 'boolean') {
        sendError(res, 400, validationError('PAYOR_PLAN'), 'Missing required plan fields');
        return;
      }
      if (!Object.values(PlanType).includes(plan.planType)) {
        sendError(res, 400, validationError('PAYOR_PLAN'), `Invalid planType: ${plan.planType}`);
        return;
      }
    }

    const now = Math.floor(Date.now() / 1000);

    const payor = await prisma.payor.create({
      data: {
        name,
        externalPayorId,
        payorCategory,
        billingTaxonomy,
        address,
        phone,
        portalUrl,
        organization: { connect: { id: organizationId as string } },
        createdBy: { connect: { id: req.user!.userId } },
        updatedBy: { connect: { id: req.user!.userId } },
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
        plans: {
          create: plans.map((plan: any) => ({
            planName: plan.planName,
            planType: plan.planType,
            isInNetwork: plan.isInNetwork,
            createdAt: BigInt(now),
            updatedAt: BigInt(now),
          })),
        },
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        plans: true,
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...payor,
        createdAt: Number(payor.createdAt),
        updatedAt: Number(payor.updatedAt),
        plans: payor.plans.map(plan => ({
          ...plan,
          createdAt: Number(plan.createdAt),
          updatedAt: Number(plan.updatedAt),
        }))
      },
    });
  } catch (error) {
    console.error('Create payor error:', error);
    sendError(res, 500, 'PAYOR_INTERNAL_ERROR', 'Internal server error');
  }
};

// Update a payor
export const updatePayor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, externalPayorId, payorCategory, billingTaxonomy, address, phone, portalUrl, plans } = req.body;
    const now = Math.floor(Date.now() / 1000);

    // Ensure user is updating a payor within their own organization
    const existingPayor = await prisma.payor.findUnique({ where: { id: id as string } });
    if (!existingPayor || existingPayor.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('PAYOR'), 'Cannot update payors outside your organization or payor not found');
      return;
    }

    // Check for duplicate externalPayorId within the organization if externalPayorId is being updated
    if (externalPayorId && externalPayorId !== existingPayor.externalPayorId) {
      const duplicateExternalPayorId = await prisma.payor.findFirst({ where: { externalPayorId, organizationId: existingPayor.organizationId } });
      if (duplicateExternalPayorId) {
        sendError(res, 409, duplicate('PAYOR'), 'Payor with this externalPayorId already exists in this organization');
        return;
      }
    }

    // Handle plans update (simplified: delete all and recreate)
    if (plans) {
      await prisma.payorPlan.deleteMany({ where: { payorId: id as string } });
      for (const plan of plans) {
        if (!plan.planName || !plan.planType || typeof plan.isInNetwork !== 'boolean') {
          sendError(res, 400, validationError('PAYOR_PLAN'), 'Missing required plan fields');
          return;
        }
        if (!Object.values(PlanType).includes(plan.planType)) {
          sendError(res, 400, validationError('PAYOR_PLAN'), `Invalid planType: ${plan.planType}`);
          return;
        }
        await prisma.payorPlan.create({
          data: {
            payor: { connect: { id: id as string } },
            planName: plan.planName,
            planType: plan.planType,
            isInNetwork: plan.isInNetwork,
            createdAt: BigInt(now),
            updatedAt: BigInt(now),
          }
        });
      }
    }

    const payor = await prisma.payor.update({
      where: { id: id as string },
      data: {
        name,
        externalPayorId,
        payorCategory,
        billingTaxonomy,
        address,
        phone,
        portalUrl,
        updatedBy: { connect: { id: req.user!.userId } },
        updatedAt: BigInt(now),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        plans: true,
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...payor,
        createdAt: Number(payor.createdAt),
        updatedAt: Number(payor.updatedAt),
        plans: payor.plans.map(plan => ({
          ...plan,
          createdAt: Number(plan.createdAt),
          updatedAt: Number(plan.updatedAt),
        }))
      },
    });
  } catch (error) {
    console.error('Update payor error:', error);
    sendError(res, 500, 'PAYOR_INTERNAL_ERROR', 'Internal server error');
  }
};

// Delete a payor
export const deletePayor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Ensure user is deleting a payor within their own organization
    const existingPayor = await prisma.payor.findUnique({ where: { id: id as string } });
    if (!existingPayor || existingPayor.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('PAYOR'), 'Cannot delete payors outside your organization or payor not found');
      return;
    }

    // Check for dependent records
    const dependentRecords = await prisma.$transaction([
      prisma.payorPlan.count({ where: { payorId: id as string } }),
      prisma.claim.count({ where: { payorId: id as string } }),
    ]);

    const hasDependents = dependentRecords.some(count => count > 0);

    if (hasDependents) {
      sendError(res, 409, deleteFailed('PAYOR'), 'Payor has dependent records and cannot be deleted');
      return;
    }

    await prisma.payor.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete payor error:', error);
    sendError(res, 500, 'PAYOR_INTERNAL_ERROR', 'Internal server error');
  }
};
