"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCPTCode = exports.updateCPTCode = exports.createCPTCode = exports.getCPTCodeById = exports.getCPTCodes = void 0;
const client_1 = require("@prisma/client");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new client_1.PrismaClient();
const getCPTCodes = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, specialty } = req.query;
        const where = {
            organizationId: req.user?.organizationId,
        };
        if (search && typeof search === 'string') {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (organizationId && typeof organizationId === 'string') {
            where.organizationId = organizationId;
        }
        if (specialty && typeof specialty === 'string') {
            where.specialty = { contains: specialty, mode: 'insensitive' };
        }
        const [cptCodes, total] = await prisma.$transaction([
            prisma.cPTCode.findMany({
                where,
                skip,
                take: limit,
            }),
            prisma.cPTCode.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: cptCodes.map(c => ({
                ...c,
                createdAt: Number(c.createdAt),
                updatedAt: Number(c.updatedAt),
            })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CPT_CODE');
    }
};
exports.getCPTCodes = getCPTCodes;
const getCPTCodeById = async (req, res) => {
    try {
        const { id } = req.params;
        const cptCode = await prisma.cPTCode.findUnique({
            where: { code: id },
        });
        if (!cptCode) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('CPT_CODE'), 'CPT code not found');
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                ...cptCode,
                createdAt: Number(cptCode.createdAt),
                updatedAt: Number(cptCode.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CPT_CODE');
    }
};
exports.getCPTCodeById = getCPTCodeById;
const createCPTCode = async (req, res) => {
    try {
        const { code, description, specialty, basePrice, organizationId } = req.body;
        if (!code || !description || basePrice === undefined || !organizationId) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('CPT_CODE'), 'Missing required CPT code fields');
            return;
        }
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('CPT_CODE'), 'Cannot create CPT codes outside your organization');
            return;
        }
        const existingCode = await prisma.cPTCode.findFirst({ where: { code, organizationId: organizationId } });
        if (existingCode) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('CPT_CODE'), 'CPT code already exists in this organization');
            return;
        }
        if (basePrice < 0) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('CPT_CODE'), 'Base price must be positive');
            return;
        }
        const now = Math.floor(Date.now() / 1000);
        const cptCode = await prisma.cPTCode.create({
            data: {
                code,
                description,
                specialty,
                standardPrice: basePrice || 0,
                basePrice,
                organization: { connect: { id: organizationId } },
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
            },
        });
        res.status(201).json({
            success: true,
            data: {
                ...cptCode,
                createdAt: Number(cptCode.createdAt),
                updatedAt: Number(cptCode.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CPT_CODE');
    }
};
exports.createCPTCode = createCPTCode;
const updateCPTCode = async (req, res) => {
    try {
        const { id } = req.params;
        const { code, description, specialty, basePrice } = req.body;
        const now = Math.floor(Date.now() / 1000);
        const existingCode = await prisma.cPTCode.findUnique({ where: { code: id } });
        if (!existingCode || existingCode.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('CPT_CODE'), 'Cannot update CPT codes outside your organization or code not found');
            return;
        }
        if (code && code !== existingCode.code) {
            const duplicateCode = await prisma.cPTCode.findFirst({ where: { code, organizationId: existingCode.organizationId } });
            if (duplicateCode) {
                (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('CPT_CODE'), 'CPT code already exists in this organization');
                return;
            }
        }
        if (basePrice !== undefined && basePrice < 0) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('CPT_CODE'), 'Base price must be positive');
            return;
        }
        const cptCode = await prisma.cPTCode.update({
            where: { code: id },
            data: {
                code,
                description,
                specialty,
                basePrice,
                updatedAt: BigInt(now),
            },
        });
        res.status(200).json({
            success: true,
            data: {
                ...cptCode,
                createdAt: Number(cptCode.createdAt),
                updatedAt: Number(cptCode.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CPT_CODE');
    }
};
exports.updateCPTCode = updateCPTCode;
const deleteCPTCode = async (req, res) => {
    try {
        const { id } = req.params;
        const existingCode = await prisma.cPTCode.findUnique({ where: { code: id } });
        if (!existingCode || existingCode.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('CPT_CODE'), 'Cannot delete CPT codes outside your organization or code not found');
            return;
        }
        const serviceCount = await prisma.claimService.count({ where: { cptCodeCode: id } });
        if (serviceCount > 0) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.deleteFailed)('CPT_CODE'), 'CPT code is used in claim services and cannot be deleted');
            return;
        }
        await prisma.cPTCode.delete({ where: { code: id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CPT_CODE');
    }
};
exports.deleteCPTCode = deleteCPTCode;
