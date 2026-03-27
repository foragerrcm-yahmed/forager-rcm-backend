"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePayor = exports.updatePayor = exports.createPayor = exports.getPayorById = exports.getPayors = void 0;
const prisma_1 = require("../../generated/prisma");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new prisma_1.PrismaClient();
// Get all payors
const getPayors = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, payorCategory } = req.query;
        const where = {
            organizationId: req.user?.organizationId, // Only payors within the authenticated user's organization
        };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { externalPayorId: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (organizationId) {
            where.organizationId = organizationId;
        }
        if (payorCategory) {
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
                    masterPayor: {
                        select: { id: true, displayName: true, primaryPayorId: true, stediId: true }
                    },
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
                plans: payor.plans?.map((plan) => ({
                    ...plan,
                    createdAt: Number(plan.createdAt),
                    updatedAt: Number(plan.updatedAt),
                }))
            })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PAYOR');
    }
};
exports.getPayors = getPayors;
// Get payor by ID
const getPayorById = async (req, res) => {
    try {
        const { id } = req.params;
        const payor = await prisma.payor.findUnique({
            where: { id, organizationId: req.user?.organizationId },
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
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PAYOR'), 'Payor not found');
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                ...payor,
                createdAt: Number(payor.createdAt),
                updatedAt: Number(payor.updatedAt),
                plans: payor.plans?.map((plan) => ({
                    ...plan,
                    createdAt: Number(plan.createdAt),
                    updatedAt: Number(plan.updatedAt),
                }))
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PAYOR');
    }
};
exports.getPayorById = getPayorById;
// Create a new payor
const createPayor = async (req, res) => {
    try {
        const { name, externalPayorId, payorCategory, billingTaxonomy, address, phone, portalUrl, organizationId, plans } = req.body;
        // Basic validation
        if (!name || !externalPayorId || !payorCategory || !billingTaxonomy || !organizationId || !plans || plans.length === 0) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PAYOR'), 'Missing required payor fields or plans');
            return;
        }
        // Ensure user is creating within their own organization
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PAYOR'), 'Cannot create payors outside your organization');
            return;
        }
        // Check if organization exists
        const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!organization) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('ORGANIZATION'), 'Organization not found');
            return;
        }
        // Check for duplicate externalPayorId within the organization
        const existingPayor = await prisma.payor.findFirst({ where: { externalPayorId, organizationId } });
        if (existingPayor) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('PAYOR'), 'Payor with this externalPayorId already exists in this organization');
            return;
        }
        // Validate plans
        for (const plan of plans) {
            if (!plan.planName || !plan.planType || typeof plan.isInNetwork !== 'boolean') {
                (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PAYOR_PLAN'), 'Missing required plan fields');
                return;
            }
            if (!Object.values(prisma_1.PlanType).includes(plan.planType)) {
                (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PAYOR_PLAN'), `Invalid planType: ${plan.planType}`);
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
                organizationId,
                createdById: req.user.userId,
                updatedById: req.user.userId,
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
                plans: {
                    create: plans.map((plan) => ({
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
                plans: payor.plans?.map((plan) => ({
                    ...plan,
                    createdAt: Number(plan.createdAt),
                    updatedAt: Number(plan.updatedAt),
                }))
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PAYOR');
    }
};
exports.createPayor = createPayor;
// Update a payor
const updatePayor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, externalPayorId, payorCategory, billingTaxonomy, address, phone, portalUrl, stediPayorId, plans } = req.body;
        const now = Math.floor(Date.now() / 1000);
        // Ensure user is updating a payor within their own organization
        const existingPayor = await prisma.payor.findUnique({ where: { id } });
        if (!existingPayor || existingPayor.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PAYOR'), 'Cannot update payors outside your organization or payor not found');
            return;
        }
        // Check for duplicate externalPayorId within the organization if externalPayorId is being updated
        if (externalPayorId && externalPayorId !== existingPayor.externalPayorId) {
            const duplicateExternalPayorId = await prisma.payor.findFirst({ where: { externalPayorId, organizationId: existingPayor.organizationId } });
            if (duplicateExternalPayorId) {
                (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('PAYOR'), 'Payor with this externalPayorId already exists in this organization');
                return;
            }
        }
        // Handle plans update (simplified: delete all and recreate)
        if (plans) {
            await prisma.payorPlan.deleteMany({ where: { payorId: id } });
            for (const plan of plans) {
                if (!plan.planName || !plan.planType || typeof plan.isInNetwork !== 'boolean') {
                    (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PAYOR_PLAN'), 'Missing required plan fields');
                    return;
                }
                if (!Object.values(prisma_1.PlanType).includes(plan.planType)) {
                    (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PAYOR_PLAN'), `Invalid planType: ${plan.planType}`);
                    return;
                }
                await prisma.payorPlan.create({
                    data: {
                        payor: { connect: { id } },
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
            where: { id },
            data: {
                name,
                externalPayorId,
                payorCategory,
                billingTaxonomy,
                address,
                phone,
                portalUrl,
                ...(stediPayorId !== undefined ? { stediPayorId } : {}),
                updatedById: req.user.userId,
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
                plans: payor.plans?.map((plan) => ({
                    ...plan,
                    createdAt: Number(plan.createdAt),
                    updatedAt: Number(plan.updatedAt),
                }))
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PAYOR');
    }
};
exports.updatePayor = updatePayor;
// Delete a payor
const deletePayor = async (req, res) => {
    try {
        const { id } = req.params;
        // Ensure user is deleting a payor within their own organization
        const existingPayor = await prisma.payor.findUnique({ where: { id } });
        if (!existingPayor || existingPayor.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PAYOR'), 'Cannot delete payors outside your organization or payor not found');
            return;
        }
        // Check for dependent records
        const dependentRecords = await prisma.$transaction([
            prisma.payorPlan.count({ where: { payorId: id } }),
            prisma.claim.count({ where: { payorId: id } }),
        ]);
        const hasDependents = dependentRecords.some(count => count > 0);
        if (hasDependents) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.deleteFailed)('PAYOR'), 'Payor has dependent records and cannot be deleted');
            return;
        }
        await prisma.payor.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PAYOR');
    }
};
exports.deletePayor = deletePayor;
