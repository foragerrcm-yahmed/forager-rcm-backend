"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteOrganization = exports.updateOrganization = exports.createOrganization = exports.getOrganizationById = exports.getOrganizations = void 0;
const client_1 = require("@prisma/client");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new client_1.PrismaClient();
// Get all organizations
const getOrganizations = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, parentOrganizationId } = req.query;
        const where = {};
        // Users can only see organizations they belong to or are children of
        if (req.user?.role !== 'Admin') {
            where.OR = [
                { id: req.user?.organizationId },
                { parentOrganizationId: req.user?.organizationId }
            ];
        }
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }
        if (parentOrganizationId) {
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
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'ORGANIZATION');
    }
};
exports.getOrganizations = getOrganizations;
// Get organization by ID
const getOrganizationById = async (req, res) => {
    try {
        const { id } = req.params;
        const where = { id };
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
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('ORG'), 'Organization not found');
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'ORGANIZATION');
    }
};
exports.getOrganizationById = getOrganizationById;
// Create a new organization
const createOrganization = async (req, res) => {
    try {
        const { name, addresses, phone, email, npi, parentOrganizationId } = req.body;
        // Basic validation
        if (!name) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('ORG'), 'Organization name is required');
            return;
        }
        if (!npi || !/^\d{10}$/.test(String(npi).trim())) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('ORG'), 'A valid 10-digit Billing NPI is required');
            return;
        }
        // Check if parent organization exists if provided
        if (parentOrganizationId) {
            const parentOrg = await prisma.organization.findUnique({ where: { id: parentOrganizationId } });
            if (!parentOrg) {
                (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('ORG'), 'Parent organization not found');
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
                createdById: req.user.userId,
                updatedById: req.user.userId,
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'ORGANIZATION');
    }
};
exports.createOrganization = createOrganization;
// Update an organization
const updateOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, addresses, phone, email, npi, parentOrganizationId } = req.body;
        const now = Math.floor(Date.now() / 1000);
        // Validate NPI if provided
        if (npi !== undefined && (npi === null || npi === '' || !/^\d{10}$/.test(String(npi).trim()))) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('ORG'), 'A valid 10-digit Billing NPI is required');
            return;
        }
        // Ensure user is updating an organization they have access to
        const existingOrg = await prisma.organization.findUnique({ where: { id } });
        if (!existingOrg) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('ORG'), 'Organization not found');
            return;
        }
        if (req.user?.role !== 'Admin' && existingOrg.id !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('ORG'), 'Cannot update organizations outside your access scope');
            return;
        }
        // Check if parent organization exists if provided
        if (parentOrganizationId) {
            const parentOrg = await prisma.organization.findUnique({ where: { id: parentOrganizationId } });
            if (!parentOrg) {
                (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('ORG'), 'Parent organization not found');
                return;
            }
        }
        const organization = await prisma.organization.update({
            where: { id },
            data: {
                name,
                addresses,
                phone,
                email,
                npi,
                parentOrganizationId,
                updatedById: req.user.userId,
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'ORGANIZATION');
    }
};
exports.updateOrganization = updateOrganization;
// Delete an organization
const deleteOrganization = async (req, res) => {
    try {
        const { id } = req.params;
        // Ensure user has access to delete this organization
        const existingOrg = await prisma.organization.findUnique({ where: { id } });
        if (!existingOrg) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('ORG'), 'Organization not found');
            return;
        }
        if (req.user?.role !== 'Admin' && existingOrg.id !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('ORG'), 'Cannot delete organizations outside your access scope');
            return;
        }
        // Check for dependent records
        const dependentRecords = await prisma.$transaction([
            prisma.user.count({ where: { organizationId: id } }),
            prisma.patient.count({ where: { organizationId: id } }),
            prisma.provider.count({ where: { organizationId: id } }),
            prisma.visit.count({ where: { organizationId: id } }),
            prisma.claim.count({ where: { organizationId: id } }),
            prisma.rule.count({ where: { organizationId: id } }),
            prisma.payor.count({ where: { organizationId: id } }),
            prisma.organization.count({ where: { parentOrganizationId: id } }), // Check for child organizations
        ]);
        const hasDependents = dependentRecords.some(count => count > 0);
        if (hasDependents) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.deleteFailed)('ORG'), 'Organization has dependent records and cannot be deleted');
            return;
        }
        await prisma.organization.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'ORGANIZATION');
    }
};
exports.deleteOrganization = deleteOrganization;
