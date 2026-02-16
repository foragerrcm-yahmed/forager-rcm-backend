import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound } from '../utils/errors';

const prisma = new PrismaClient();

export const getRuleExecutions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { ruleId, claimId, status, dateFrom, dateTo } = req.query;

    const where: any = {};

    if (ruleId && typeof ruleId === 'string') {
      where.ruleId = ruleId;
    }

    if (claimId && typeof claimId === 'string') {
      where.claimId = claimId;
    }

    if (status && typeof status === 'string') {
      where.status = status;
    }

    if (dateFrom || dateTo) {
      where.executedAt = {};
      if (dateFrom) where.executedAt.gte = BigInt(dateFrom as string);
      if (dateTo) where.executedAt.lte = BigInt(dateTo as string);
    }

    const [executions, total] = await prisma.$transaction([
      prisma.ruleExecution.findMany({
        where,
        skip,
        take: limit,
      }),
      prisma.ruleExecution.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: executions.map(e => ({
        ...e,
        executedAt: Number(e.executedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get rule executions error:', error);
    sendError(res, 500, 'RULE_EXECUTION_INTERNAL_ERROR', 'Internal server error');
  }
};

export const getRuleExecutionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const execution = await prisma.ruleExecution.findUnique({
      where: { id: id as string },
    });

    if (!execution) {
      sendError(res, 404, notFound('RULE_EXECUTION'), 'Rule execution not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...execution,
        executedAt: Number(execution.executedAt),
      },
    });
  } catch (error) {
    console.error('Get rule execution by ID error:', error);
    sendError(res, 500, 'RULE_EXECUTION_INTERNAL_ERROR', 'Internal server error');
  }
};
