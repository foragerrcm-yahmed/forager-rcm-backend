import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, forbidden, foreignKeyError } from '../utils/errors';

const prisma = new PrismaClient();

export const getInsurancePolicies = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { patientId, payorId, isPrimary, isActive } = req.query;

    const where: any = {};

    if (patientId && typeof patientId === 'string') {
      where.patientId = patientId;
    }

    if (payorId && typeof payorId === 'string') {
      where.plan = {
        payor: {
          id: payorId
        }
      };
    }

    if (isPrimary !== undefined) {
      where.isPrimary = isPrimary === 'true';
    }

    const [policies, total] = await prisma.$transaction([
      prisma.patientInsurance.findMany({
        where,
        skip,
        take: limit,
        include: {
          plan: {
            include: {
              payor: {
                select: { id: true, name: true }
              }
            }
          }
        }
      }),
      prisma.patientInsurance.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: policies.map(p => ({
        ...p,
        subscriberDob: p.subscriberDob ? Number(p.subscriberDob) : null,
        createdAt: Number(p.createdAt),
        updatedAt: Number(p.updatedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get insurance policies error:', error);
    sendError(res, 500, 'INSURANCE_POLICY_INTERNAL_ERROR', 'Internal server error');
  }
};

export const getInsurancePolicyById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const policy = await prisma.patientInsurance.findUnique({
      where: { id: id as string },
      include: {
        plan: {
          include: {
            payor: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!policy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...policy,
        subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
        createdAt: Number(policy.createdAt),
        updatedAt: Number(policy.updatedAt),
      },
    });
  } catch (error) {
    console.error('Get insurance policy by ID error:', error);
    sendError(res, 500, 'INSURANCE_POLICY_INTERNAL_ERROR', 'Internal server error');
  }
};

export const updateInsurancePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isPrimary, subscriberName, subscriberDob, memberId } = req.body;
    const now = Math.floor(Date.now() / 1000);

    const existingPolicy = await prisma.patientInsurance.findUnique({ where: { id: id as string } });
    if (!existingPolicy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    const policy = await prisma.patientInsurance.update({
      where: { id: id as string },
      data: {
        isPrimary,
        subscriberName,
        subscriberDob: subscriberDob ? BigInt(subscriberDob) : undefined,
        memberId,
        updatedAt: BigInt(now),
      },
      include: {
        plan: {
          include: {
            payor: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...policy,
        subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
        createdAt: Number(policy.createdAt),
        updatedAt: Number(policy.updatedAt),
      },
    });
  } catch (error) {
    console.error('Update insurance policy error:', error);
    sendError(res, 500, 'INSURANCE_POLICY_INTERNAL_ERROR', 'Internal server error');
  }
};

export const deleteInsurancePolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingPolicy = await prisma.patientInsurance.findUnique({ where: { id: id as string } });
    if (!existingPolicy) {
      sendError(res, 404, notFound('INSURANCE_POLICY'), 'Insurance policy not found');
      return;
    }

    await prisma.patientInsurance.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete insurance policy error:', error);
    sendError(res, 500, 'INSURANCE_POLICY_INTERNAL_ERROR', 'Internal server error');
  }
};
