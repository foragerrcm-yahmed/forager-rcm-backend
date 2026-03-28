"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProvider = exports.updateProvider = exports.createProvider = exports.getProviderById = exports.getProviders = void 0;
const prisma_1 = require("../../generated/prisma");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new prisma_1.PrismaClient();
// Get all providers
const getProviders = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, specialty, licenseType, source } = req.query;
        const where = {
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
            where.licenseType = licenseType;
        }
        if (source) {
            where.source = source;
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
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PROVIDER');
    }
};
exports.getProviders = getProviders;
// Get provider by ID
const getProviderById = async (req, res) => {
    try {
        const { id } = req.params;
        const [provider, visitCount, claimCount] = await prisma.$transaction([
            prisma.provider.findUnique({
                where: { id, organizationId: req.user?.organizationId },
                include: {
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    updatedBy: { select: { id: true, firstName: true, lastName: true } },
                    providerCredentials: {
                        include: {
                            masterPayor: { select: { id: true, displayName: true, avatarUrl: true } },
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                },
            }),
            prisma.visit.count({ where: { providerId: id, organizationId: req.user?.organizationId } }),
            prisma.claim.count({ where: { providerId: id, organizationId: req.user?.organizationId } }),
        ]);
        if (!provider) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PROVIDER'), 'Provider not found');
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                ...provider,
                createdAt: Number(provider.createdAt),
                updatedAt: Number(provider.updatedAt),
                providerCredentials: provider.providerCredentials.map((c) => ({
                    ...c,
                    effectiveDate: c.effectiveDate ? Number(c.effectiveDate) : null,
                    expirationDate: c.expirationDate ? Number(c.expirationDate) : null,
                    createdAt: Number(c.createdAt),
                    updatedAt: Number(c.updatedAt),
                })),
                _counts: { visits: visitCount, claims: claimCount },
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PROVIDER');
    }
};
exports.getProviderById = getProviderById;
// Create a new provider
const createProvider = async (req, res) => {
    try {
        const { firstName, middleName, lastName, npi, specialty, licenseType, organizationId, source } = req.body;
        // Basic validation
        if (!firstName || !lastName || !licenseType || !organizationId || !source) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PROVIDER'), 'Missing required provider fields');
            return;
        }
        // Ensure user is creating within their own organization
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PROVIDER'), 'Cannot create providers outside your organization');
            return;
        }
        // Check if organization exists
        const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!organization) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('ORGANIZATION'), 'Organization not found');
            return;
        }
        // Check for duplicate NPI within the organization
        if (npi) {
            const existingProvider = await prisma.provider.findFirst({ where: { npi, organizationId } });
            if (existingProvider) {
                (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('PROVIDER'), 'Provider with this NPI already exists in this organization');
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
                organizationId,
                source,
                createdById: req.user.userId,
                updatedById: req.user.userId,
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PROVIDER');
    }
};
exports.createProvider = createProvider;
// Update a provider
const updateProvider = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, middleName, lastName, npi, specialty, licenseType, source, taxonomyCode } = req.body;
        const now = Math.floor(Date.now() / 1000);
        // Ensure user is updating a provider within their own organization
        const existingProvider = await prisma.provider.findUnique({ where: { id } });
        if (!existingProvider || existingProvider.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PROVIDER'), 'Cannot update providers outside your organization or provider not found');
            return;
        }
        // Check for duplicate NPI within the organization if NPI is being updated
        if (npi && npi !== existingProvider.npi) {
            const duplicateNpi = await prisma.provider.findFirst({ where: { npi, organizationId: existingProvider.organizationId } });
            if (duplicateNpi) {
                (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('PROVIDER'), 'Provider with this NPI already exists in this organization');
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
                taxonomyCode,
                updatedById: req.user.userId,
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PROVIDER');
    }
};
exports.updateProvider = updateProvider;
// Delete a provider
const deleteProvider = async (req, res) => {
    try {
        const { id } = req.params;
        // Ensure user is deleting a provider within their own organization
        const existingProvider = await prisma.provider.findUnique({ where: { id } });
        if (!existingProvider || existingProvider.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PROVIDER'), 'Cannot delete providers outside your organization or provider not found');
            return;
        }
        // Check for dependent records
        const dependentRecords = await prisma.$transaction([
            prisma.visit.count({ where: { providerId: id } }),
            prisma.claim.count({ where: { providerId: id } }),
        ]);
        const hasDependents = dependentRecords.some(count => count > 0);
        if (hasDependents) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.deleteFailed)('PROVIDER'), 'Provider has dependent records and cannot be deleted');
            return;
        }
        await prisma.provider.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PROVIDER');
    }
};
exports.deleteProvider = deleteProvider;
