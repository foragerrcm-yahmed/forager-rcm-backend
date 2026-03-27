"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteRule = exports.toggleRuleStatus = exports.updateRule = exports.createRule = exports.getRuleById = exports.getRules = void 0;
const prisma_1 = require("../../generated/prisma");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new prisma_1.PrismaClient();
const getRules = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, isActive } = req.query;
        const where = {
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
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'RULE');
    }
};
exports.getRules = getRules;
const getRuleById = async (req, res) => {
    try {
        const { id } = req.params;
        const rule = await prisma.rule.findUnique({
            where: { id: id, organizationId: req.user?.organizationId },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
            }
        });
        if (!rule) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('RULE'), 'Rule not found');
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'RULE');
    }
};
exports.getRuleById = getRuleById;
const createRule = async (req, res) => {
    try {
        const { name, description, organizationId, isActive, flowData } = req.body;
        if (!name || !organizationId || !flowData) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('RULE'), 'Missing required rule fields');
            return;
        }
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('RULE'), 'Cannot create rules outside your organization');
            return;
        }
        const existingRule = await prisma.rule.findFirst({ where: { name, organizationId: organizationId } });
        if (existingRule) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('RULE'), 'Rule with this name already exists in this organization');
            return;
        }
        const now = Math.floor(Date.now() / 1000);
        const rule = await prisma.rule.create({
            data: {
                name,
                description,
                triggerType: 'Manual',
                organization: { connect: { id: organizationId } },
                isActive: isActive || false,
                flowData,
                createdBy: { connect: { id: req.user.userId } },
                updatedBy: { connect: { id: req.user.userId } },
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'RULE');
    }
};
exports.createRule = createRule;
const updateRule = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, isActive, flowData } = req.body;
        const now = Math.floor(Date.now() / 1000);
        const existingRule = await prisma.rule.findUnique({ where: { id: id } });
        if (!existingRule || existingRule.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('RULE'), 'Cannot update rules outside your organization or rule not found');
            return;
        }
        if (name && name !== existingRule.name) {
            const duplicateRule = await prisma.rule.findFirst({ where: { name, organizationId: existingRule.organizationId } });
            if (duplicateRule) {
                (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('RULE'), 'Rule with this name already exists in this organization');
                return;
            }
        }
        const rule = await prisma.rule.update({
            where: { id: id },
            data: {
                name,
                description,
                isActive,
                flowData,
                updatedBy: { connect: { id: req.user.userId } },
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'RULE');
    }
};
exports.updateRule = updateRule;
const toggleRuleStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const now = Math.floor(Date.now() / 1000);
        if (isActive === undefined) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('RULE'), 'isActive field is required');
            return;
        }
        const existingRule = await prisma.rule.findUnique({ where: { id: id } });
        if (!existingRule || existingRule.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('RULE'), 'Cannot update rules outside your organization or rule not found');
            return;
        }
        const rule = await prisma.rule.update({
            where: { id: id },
            data: {
                isActive,
                updatedBy: { connect: { id: req.user.userId } },
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'RULE');
    }
};
exports.toggleRuleStatus = toggleRuleStatus;
const deleteRule = async (req, res) => {
    try {
        const { id } = req.params;
        const existingRule = await prisma.rule.findUnique({ where: { id: id } });
        if (!existingRule || existingRule.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('RULE'), 'Cannot delete rules outside your organization or rule not found');
            return;
        }
        await prisma.rule.delete({ where: { id: id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'RULE');
    }
};
exports.deleteRule = deleteRule;
