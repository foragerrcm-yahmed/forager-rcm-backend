"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInsurancePolicy = exports.updateInsurancePolicy = exports.createInsurancePolicy = exports.getInsurancePolicyById = exports.getInsurancePolicies = void 0;
const client_1 = require("@prisma/client");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new client_1.PrismaClient();
const getInsurancePolicies = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { patientId, payorId, isPrimary, isActive } = req.query;
        const where = {};
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
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.getInsurancePolicies = getInsurancePolicies;
const getInsurancePolicyById = async (req, res) => {
    try {
        const { id } = req.params;
        const policy = await prisma.patientInsurance.findUnique({
            where: { id: id },
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
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('INSURANCE_POLICY'), 'Insurance policy not found');
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.getInsurancePolicyById = getInsurancePolicyById;
const createInsurancePolicy = async (req, res) => {
    try {
        const { patientId, planId, isPrimary, insuredType, subscriberName, subscriberDob, memberId } = req.body;
        const now = Math.floor(Date.now() / 1000);
        if (!patientId || !planId || isPrimary === undefined || !insuredType || !memberId) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('INSURANCE_POLICY'), 'Missing required fields: patientId, planId, isPrimary, insuredType, memberId');
            return;
        }
        // Validate patient exists
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PATIENT'), 'Patient not found');
            return;
        }
        // Validate plan exists
        const plan = await prisma.payorPlan.findUnique({ where: { id: planId } });
        if (!plan) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PAYOR_PLAN'), 'Payor plan not found');
            return;
        }
        const policy = await prisma.patientInsurance.create({
            data: {
                patient: { connect: { id: patientId } },
                plan: { connect: { id: planId } },
                isPrimary,
                insuredType,
                subscriberName,
                subscriberDob: subscriberDob ? BigInt(subscriberDob) : undefined,
                memberId,
                createdAt: BigInt(now),
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
        res.status(201).json({
            success: true,
            data: {
                ...policy,
                subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
                createdAt: Number(policy.createdAt),
                updatedAt: Number(policy.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.createInsurancePolicy = createInsurancePolicy;
const updateInsurancePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const { isPrimary, isActive, subscriberName, subscriberDob, memberId, planId, insuredType } = req.body;
        const now = Math.floor(Date.now() / 1000);
        const existingPolicy = await prisma.patientInsurance.findUnique({ where: { id: id } });
        if (!existingPolicy) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('INSURANCE_POLICY'), 'Insurance policy not found');
            return;
        }
        const policy = await prisma.patientInsurance.update({
            where: { id: id },
            data: {
                isPrimary,
                insuredType,
                subscriberName,
                subscriberDob: subscriberDob ? BigInt(subscriberDob) : undefined,
                memberId,
                ...(planId ? { plan: { connect: { id: planId } } } : {}),
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
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.updateInsurancePolicy = updateInsurancePolicy;
const deleteInsurancePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const existingPolicy = await prisma.patientInsurance.findUnique({ where: { id: id } });
        if (!existingPolicy) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('INSURANCE_POLICY'), 'Insurance policy not found');
            return;
        }
        await prisma.patientInsurance.delete({ where: { id: id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.deleteInsurancePolicy = deleteInsurancePolicy;
