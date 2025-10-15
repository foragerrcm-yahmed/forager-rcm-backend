import { Request, Response } from 'express';
import { PrismaClient, DataSource, ProviderLicenseType } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';

const prisma = new PrismaClient();

// Get all providers
export const getProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, specialty, licenseType, source } = req.query;

    const where: any = {
      organizationId: req.user?.organizationId, // Only providers within the authenticated user's organization
    };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { npi: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (organizationId) {
      where.organizationId = organizationId;
    }

    if (specialty) {
      where.specialty = { contains: specialty, mode: 'insensitive' };
    }

    if (licenseType) {
      where.licenseType = licenseType as ProviderLicenseType;
    }

    if (source) {
      where.source = source as DataSource;
    }

    const [providers, total] = await prisma.$transaction([
      prisma.provider.findMany({
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
        }
      }),
      prisma.provider.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: providers.map(provider => ({
        ...provider,
        createdAt: Number(provider.createdAt),
        updatedAt: Number(provider.updatedAt),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get providers error:', error);
    sendError(res, 500, 'PROVIDER_INTERNAL_ERROR', 'Internal server error');
  }
};

// Get provider by ID
export const getProviderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const provider = await prisma.provider.findUnique({
      where: { id, organizationId: req.user?.organizationId },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
      }
    });

    if (!provider) {
      sendError(res, 404, notFound('PROVIDER'), 'Provider not found');
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        ...provider,
        createdAt: Number(provider.createdAt),
        updatedAt: Number(provider.updatedAt),
      },
    });
  } catch (error) {
    console.error('Get provider by ID error:', error);
    sendError(res, 500, 'PROVIDER_INTERNAL_ERROR', 'Internal server error');
  }
};

// Create a new provider
export const createProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, middleName, lastName, npi, specialty, licenseType, organizationId, source } = req.body;

    // Basic validation
    if (!firstName || !lastName || !licenseType || !organizationId || !source) {
      sendError(res, 400, validationError('PROVIDER'), 'Missing required provider fields');
      return;
    }

    // Ensure user is creating within their own organization
    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('PROVIDER'), 'Cannot create providers outside your organization');
      return;
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) {
      sendError(res, 404, foreignKeyError('ORGANIZATION'), 'Organization not found');
      return;
    }

    // Check for duplicate NPI within the organization
    if (npi) {
      const existingProvider = await prisma.provider.findFirst({ where: { npi, organizationId } });
      if (existingProvider) {
        sendError(res, 409, duplicate('PROVIDER'), 'Provider with this NPI already exists in this organization');
        return;
      }
    }

    const now = Math.floor(Date.now() / 1000);

    const provider = await prisma.provider.create({
      data: {
        firstName,
        middleName,
        lastName,
        npi,
        specialty,
        licenseType,
        organization: { connect: { id: organizationId } },
        source,
        createdById: req.user!.userId,
        updatedById: req.user!.userId,
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
        ...provider,
        createdAt: Number(provider.createdAt),
        updatedAt: Number(provider.updatedAt),
      },
    });
  } catch (error) {
    console.error('Create provider error:', error);
    sendError(res, 500, 'PROVIDER_INTERNAL_ERROR', 'Internal server error');
  }
};

// Update a provider
export const updateProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, middleName, lastName, npi, specialty, licenseType, source } = req.body;
    const now = Math.floor(Date.now() / 1000);

    // Ensure user is updating a provider within their own organization
    const existingProvider = await prisma.provider.findUnique({ where: { id } });
    if (!existingProvider || existingProvider.organizationId !== req.user?.organizationId) {
      sendError(res, 403, forbidden('PROVIDER'), 'Cannot update providers outside your organization or provider not found');
      return;
    }

    // Check for duplicate NPI within the organization if NPI is being updated
    if (npi && npi !== existingProvider.npi) {
      const duplicateNpi = await prisma.provider.findFirst({ where: { npi, organizationId: existingProvider.organizationId } });
      if (duplicateNpi) {
        sendError(res, 409, duplicate('PROVIDER'), 'Provider with this NPI already exists in this organization');
        return;
      }
    }

    const provider = await prisma.provider.update({
      where: { id },
      data: {
        firstName,
        middleName,
        lastName,
        npi,
        specialty,
        licenseType,
        source,
        updatedById: req.user!.userId,
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
        ...provider,
        createdAt: Number(provider.createdAt),
        updatedAt: Number(provider.updatedAt),
      },
    });
  } catch (error) {
    console.error('Update provider error:', error);
    sendError(res, 500, 'PROVIDER_INTERNAL_ERROR', 'Internal server error');
  }
};

// Delete a provider
export const deleteProvider = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Ensure user is deleting a provider within their own organization
    const existingProvider = await prisma.provider.findUnique({ where: { id } });
    if (!existingProvider || existingProvider.organizationId !== req.user?.organizationId) {
      sendError(res, 403, forbidden('PROVIDER'), 'Cannot delete providers outside your organization or provider not found');
      return;
    }

    // Check for dependent records
    const dependentRecords = await prisma.$transaction([
      prisma.visit.count({ where: { providerId: id } }),
      prisma.claim.count({ where: { providerId: id } }),
    ]);

    const hasDependents = dependentRecords.some(count => count > 0);

    if (hasDependents) {
      sendError(res, 409, deleteFailed('PROVIDER'), 'Provider has dependent records and cannot be deleted');
      return;
    }

    await prisma.provider.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete provider error:', error);
    sendError(res, 500, 'PROVIDER_INTERNAL_ERROR', 'Internal server error');
  }
};

