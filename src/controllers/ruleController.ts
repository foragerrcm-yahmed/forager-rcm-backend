import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden } from '../utils/errors';

const prisma = new PrismaClient();

export const getRules = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, isActive } = req.query;

    const where: any = {
      organizationId: req.user?.organizationId,
    };

    if (search && typeof search === 'string') {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (organizationId && typeof organizationId === 'string') {
      where.organizationId = organizationId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [rules, total] = await prisma.$transaction([
      prisma.rule.findMany({
        where,
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          updatedBy: { select: { id: true, firstName: true, lastName: true } },
        }
      }),
      prisma.rule.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: rules.map(r => ({
        ...r,
        createdAt: Number(r.createdAt),
        updatedAt: Number(r.updatedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get rules error:', error);
    sendError(res, 500, 'RULE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const getRuleById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const rule = await prisma.rule.findUnique({
      where: { id: id as string, organizationId: req.user?.organizationId as string | undefined },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
      }
    });

    if (!rule) {
      sendError(res, 404, notFound('RULE'), 'Rule not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...rule,
        createdAt: Number(rule.createdAt),
        updatedAt: Number(rule.updatedAt),
      },
    });
  } catch (error) {
    console.error('Get rule by ID error:', error);
    sendError(res, 500, 'RULE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const createRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, organizationId, isActive, flowData } = req.body;

    if (!name || !organizationId || !flowData) {
      sendError(res, 400, validationError('RULE'), 'Missing required rule fields');
      return;
    }

    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('RULE'), 'Cannot create rules outside your organization');
      return;
    }

    const existingRule = await prisma.rule.findFirst({ where: { name, organizationId: organizationId as string } });
    if (existingRule) {
      sendError(res, 409, duplicate('RULE'), 'Rule with this name already exists in this organization');
      return;
    }

    const now = Math.floor(Date.now() / 1000);

    const rule = await prisma.rule.create({
      data: {
        name,
        description,
        triggerType: 'Manual',
        organization: { connect: { id: organizationId as string } },
        isActive: isActive || false,
        flowData,
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
        ...rule,
        createdAt: Number(rule.createdAt),
        updatedAt: Number(rule.updatedAt),
      },
    });
  } catch (error) {
    console.error('Create rule error:', error);
    sendError(res, 500, 'RULE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const updateRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, isActive, flowData } = req.body;
    const now = Math.floor(Date.now() / 1000);

    const existingRule = await prisma.rule.findUnique({ where: { id: id as string } });
    if (!existingRule || existingRule.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('RULE'), 'Cannot update rules outside your organization or rule not found');
      return;
    }

    if (name && name !== existingRule.name) {
      const duplicateRule = await prisma.rule.findFirst({ where: { name, organizationId: existingRule.organizationId } });
      if (duplicateRule) {
        sendError(res, 409, duplicate('RULE'), 'Rule with this name already exists in this organization');
        return;
      }
    }

    const rule = await prisma.rule.update({
      where: { id: id as string },
      data: {
        name,
        description,
        isActive,
        flowData,
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
        ...rule,
        createdAt: Number(rule.createdAt),
        updatedAt: Number(rule.updatedAt),
      },
    });
  } catch (error) {
    console.error('Update rule error:', error);
    sendError(res, 500, 'RULE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const toggleRuleStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const now = Math.floor(Date.now() / 1000);

    if (isActive === undefined) {
      sendError(res, 400, validationError('RULE'), 'isActive field is required');
      return;
    }

    const existingRule = await prisma.rule.findUnique({ where: { id: id as string } });
    if (!existingRule || existingRule.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('RULE'), 'Cannot update rules outside your organization or rule not found');
      return;
    }

    const rule = await prisma.rule.update({
      where: { id: id as string },
      data: {
        isActive,
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
        ...rule,
        createdAt: Number(rule.createdAt),
        updatedAt: Number(rule.updatedAt),
      },
    });
  } catch (error) {
    console.error('Toggle rule status error:', error);
    sendError(res, 500, 'RULE_INTERNAL_ERROR', 'Internal server error');
  }
};

export const deleteRule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingRule = await prisma.rule.findUnique({ where: { id: id as string } });
    if (!existingRule || existingRule.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('RULE'), 'Cannot delete rules outside your organization or rule not found');
      return;
    }

    await prisma.rule.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete rule error:', error);
    sendError(res, 500, 'RULE_INTERNAL_ERROR', 'Internal server error');
  }
};
