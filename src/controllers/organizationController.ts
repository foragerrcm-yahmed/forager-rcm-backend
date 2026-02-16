import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';

const prisma = new PrismaClient();

// Get all organizations
export const getOrganizations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, parentOrganizationId } = req.query;

    const where: any = {};

    // Users can only see organizations they belong to or are children of
    if (req.user?.role !== 'Admin') {
      where.OR = [
        { id: req.user?.organizationId },
        { parentOrganizationId: req.user?.organizationId }
      ];
    }

    if (search && typeof search === 'string') {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (parentOrganizationId && typeof parentOrganizationId === 'string') {
      where.parentOrganizationId = parentOrganizationId;
    }

    const [organizations, total] = await prisma.$transaction([
      prisma.organization.findMany({
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
          childOrganizations: {
            select: { id: true, name: true }
          }
        }
      }),
      prisma.organization.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: organizations.map(org => ({
        ...org,
        createdAt: Number(org.createdAt),
        updatedAt: Number(org.updatedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get organizations error:', error);
    sendError(res, 500, 'ORG_INTERNAL_ERROR', 'Internal server error');
  }
};

// Get organization by ID
export const getOrganizationById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const where: any = { id: id as string };

    // Users can only see organizations they belong to or are children of
    if (req.user?.role !== 'Admin') {
      where.OR = [
        { id: req.user?.organizationId },
        { parentOrganizationId: req.user?.organizationId }
      ];
    }

    const organization = await prisma.organization.findUnique({
      where,
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        childOrganizations: {
          select: { id: true, name: true }
        }
      }
    });

    if (!organization) {
      sendError(res, 404, notFound('ORG'), 'Organization not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...organization,
        createdAt: Number(organization.createdAt),
        updatedAt: Number(organization.updatedAt),
      },
    });
  } catch (error) {
    console.error('Get organization by ID error:', error);
    sendError(res, 500, 'ORG_INTERNAL_ERROR', 'Internal server error');
  }
};

// Create a new organization
export const createOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, addresses, phone, email, npi, parentOrganizationId } = req.body;

    // Basic validation
    if (!name) {
      sendError(res, 400, validationError('ORG'), 'Organization name is required');
      return;
    }

    // Check if parent organization exists if provided
    if (parentOrganizationId) {
      const parentOrg = await prisma.organization.findUnique({ where: { id: parentOrganizationId as string } });
      if (!parentOrg) {
        sendError(res, 404, foreignKeyError('ORG'), 'Parent organization not found');
        return;
      }
    }

    const now = Math.floor(Date.now() / 1000);

    const organization = await prisma.organization.create({
      data: {
        name,
        addresses,
        phone,
        email,
        npi,
        parentOrganizationId,
        createdBy: { connect: { id: req.user!.userId } },
        updatedBy: { connect: { id: req.user!.userId } },
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        childOrganizations: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...organization,
        createdAt: Number(organization.createdAt),
        updatedAt: Number(organization.updatedAt),
      },
    });
  } catch (error) {
    console.error('Create organization error:', error);
    sendError(res, 500, 'ORG_INTERNAL_ERROR', 'Internal server error');
  }
};

// Update an organization
export const updateOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, addresses, phone, email, npi, parentOrganizationId } = req.body;
    const now = Math.floor(Date.now() / 1000);

    // Ensure user is updating an organization they have access to
    const existingOrg = await prisma.organization.findUnique({ where: { id: id as string } });
    if (!existingOrg) {
      sendError(res, 404, notFound('ORG'), 'Organization not found');
      return;
    }

    if (req.user?.role !== 'Admin' && existingOrg.id !== req.user?.organizationId) {
      sendError(res, 403, forbidden('ORG'), 'Cannot update organizations outside your access scope');
      return;
    }

    // Check if parent organization exists if provided
    if (parentOrganizationId) {
      const parentOrg = await prisma.organization.findUnique({ where: { id: parentOrganizationId as string } });
      if (!parentOrg) {
        sendError(res, 404, foreignKeyError('ORG'), 'Parent organization not found');
        return;
      }
    }

    const organization = await prisma.organization.update({
      where: { id: id as string },
      data: {
        name,
        addresses,
        phone,
        email,
        npi,
        parentOrganizationId,
        updatedBy: { connect: { id: req.user!.userId } },
        updatedAt: BigInt(now),
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        childOrganizations: {
          select: { id: true, name: true }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...organization,
        createdAt: Number(organization.createdAt),
        updatedAt: Number(organization.updatedAt),
      },
    });
  } catch (error) {
    console.error('Update organization error:', error);
    sendError(res, 500, 'ORG_INTERNAL_ERROR', 'Internal server error');
  }
};

// Delete an organization
export const deleteOrganization = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Ensure user has access to delete this organization
    const existingOrg = await prisma.organization.findUnique({ where: { id: id as string } });
    if (!existingOrg) {
      sendError(res, 404, notFound('ORG'), 'Organization not found');
      return;
    }

    if (req.user?.role !== 'Admin' && existingOrg.id !== req.user?.organizationId) {
      sendError(res, 403, forbidden('ORG'), 'Cannot delete organizations outside your access scope');
      return;
    }

    // Check for dependent records
    const dependentRecords = await prisma.$transaction([
      prisma.user.count({ where: { organizationId: id as string } }),
      prisma.patient.count({ where: { organizationId: id as string } }),
      prisma.provider.count({ where: { organizationId: id as string } }),
      prisma.visit.count({ where: { organizationId: id as string } }),
      prisma.claim.count({ where: { organizationId: id as string } }),
      prisma.rule.count({ where: { organizationId: id as string } }),
      prisma.payor.count({ where: { organizationId: id as string } }),
      prisma.organization.count({ where: { parentOrganizationId: id as string } }), // Check for child organizations
    ]);

    const hasDependents = dependentRecords.some(count => count > 0);

    if (hasDependents) {
      sendError(res, 409, deleteFailed('ORG'), 'Organization has dependent records and cannot be deleted');
      return;
    }

    await prisma.organization.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete organization error:', error);
    sendError(res, 500, 'ORG_INTERNAL_ERROR', 'Internal server error');
  }
};
