"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePatient = exports.updatePatient = exports.createPatient = exports.getPatientById = exports.getPatients = void 0;
const prisma_1 = require("../../generated/prisma");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new prisma_1.PrismaClient();
// ─── Shared insurance include (always includes dependents) ────────────────────
const INSURANCE_INCLUDE = {
    plan: {
        include: {
            payor: { select: { id: true, name: true, stediPayorId: true } },
        },
    },
    // Direct payor (used when no plan is selected)
    payor: { select: { id: true, name: true, stediPayorId: true } },
    dependents: {
        orderBy: { createdAt: 'asc' },
    },
};
// ─── Serialise a policy (BigInt → Number, dependents mapped) ─────────────────
function serializePolicy(policy) {
    return {
        ...policy,
        createdAt: Number(policy.createdAt),
        updatedAt: Number(policy.updatedAt),
        subscriberDob: policy.subscriberDob != null ? Number(policy.subscriberDob) : null,
        dependents: (policy.dependents ?? []).map((d) => ({
            ...d,
            dateOfBirth: d.dateOfBirth != null ? Number(d.dateOfBirth) : null,
            createdAt: Number(d.createdAt),
            updatedAt: Number(d.updatedAt),
        })),
    };
}
// ─── List patients ────────────────────────────────────────────────────────────
const getPatients = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, source, includeInsurances } = req.query;
        const where = {
            organizationId: req.user?.organizationId,
        };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (organizationId)
            where.organizationId = organizationId;
        if (source)
            where.source = source;
        const include = {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            updatedBy: { select: { id: true, firstName: true, lastName: true } },
        };
        if (includeInsurances === 'true') {
            include.insurancePolicies = { include: INSURANCE_INCLUDE };
        }
        const [patients, total] = await prisma.$transaction([
            prisma.patient.findMany({ where, skip, take: limit, include }),
            prisma.patient.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: patients.map(patient => ({
                ...patient,
                createdAt: Number(patient.createdAt),
                updatedAt: Number(patient.updatedAt),
                dateOfBirth: Number(patient.dateOfBirth),
                ssn: patient.ssn ? '***-**-' + patient.ssn.slice(-4) : null,
                insurancePolicies: patient.insurancePolicies?.map(serializePolicy),
            })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.getPatients = getPatients;
// ─── Get patient by ID ────────────────────────────────────────────────────────
const getPatientById = async (req, res) => {
    try {
        const { id } = req.params;
        const { includeInsurances } = req.query;
        const include = {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            updatedBy: { select: { id: true, firstName: true, lastName: true } },
        };
        if (includeInsurances === 'true') {
            include.insurancePolicies = { include: INSURANCE_INCLUDE };
        }
        const patient = await prisma.patient.findUnique({
            where: { id, organizationId: req.user?.organizationId },
            include,
        });
        if (!patient) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PATIENT'), 'Patient not found');
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                ...patient,
                createdAt: Number(patient.createdAt),
                updatedAt: Number(patient.updatedAt),
                dateOfBirth: Number(patient.dateOfBirth),
                ssn: patient.ssn ? '***-**-' + patient.ssn.slice(-4) : null,
                insurancePolicies: patient.insurancePolicies?.map(serializePolicy),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.getPatientById = getPatientById;
// ─── Create patient ───────────────────────────────────────────────────────────
const createPatient = async (req, res) => {
    try {
        const { prefix, firstName, middleName, lastName, suffix, dateOfBirth, gender, ssn, phone, email, address, city, state, zipCode, organizationId, source, insurances, } = req.body;
        if (!firstName || !lastName || !dateOfBirth || !organizationId || !source) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PATIENT'), 'Missing required patient fields');
            return;
        }
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PATIENT'), 'Cannot create patients outside your organization');
            return;
        }
        const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!organization) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('ORGANIZATION'), 'Organization not found');
            return;
        }
        if (insurances && insurances.length > 0) {
            for (const ins of insurances) {
                if (ins.isPrimary === undefined || !ins.insuredType || !ins.memberId) {
                    (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PATIENT'), 'Missing required insurance fields: isPrimary, insuredType, memberId');
                    return;
                }
                if (!ins.planId && !ins.payorId) {
                    (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PATIENT'), 'Insurance must have either a planId or a payorId');
                    return;
                }
                if (ins.planId) {
                    const plan = await prisma.payorPlan.findUnique({ where: { id: ins.planId } });
                    if (!plan) {
                        (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('PAYOR_PLAN'), `Insurance plan with ID ${ins.planId} not found`);
                        return;
                    }
                }
            }
        }
        const now = BigInt(Math.floor(Date.now() / 1000));
        const patient = await prisma.patient.create({
            data: {
                prefix,
                firstName,
                middleName,
                lastName,
                suffix,
                dateOfBirth: BigInt(dateOfBirth),
                gender,
                ssn,
                phone,
                email,
                address: (address || city || state || zipCode) ? {
                    street: address || null,
                    city: city || null,
                    state: state || null,
                    zipCode: zipCode || null,
                } : undefined,
                organizationId,
                source,
                createdById: req.user.userId,
                updatedById: req.user.userId,
                createdAt: now,
                updatedAt: now,
                insurancePolicies: {
                    create: (insurances ?? []).map((ins) => ({
                        ...(ins.planId ? { plan: { connect: { id: ins.planId } } } : {}),
                        ...(ins.payorId && !ins.planId ? { payor: { connect: { id: ins.payorId } } } : {}),
                        isPrimary: ins.isPrimary,
                        insuredType: ins.insuredType,
                        subscriberName: ins.subscriberName ?? null,
                        subscriberDob: ins.subscriberDob ? BigInt(ins.subscriberDob) : null,
                        memberId: ins.memberId,
                        insuranceCardPath: ins.insuranceCard ?? null,
                        createdAt: now,
                        updatedAt: now,
                        dependents: ins.dependents?.length
                            ? {
                                create: ins.dependents.map((d) => ({
                                    firstName: d.firstName,
                                    lastName: d.lastName,
                                    dateOfBirth: d.dateOfBirth != null ? BigInt(Math.floor(Number(d.dateOfBirth))) : undefined,
                                    relationship: d.relationship ?? null,
                                    createdAt: now,
                                    updatedAt: now,
                                })),
                            }
                            : undefined,
                    })),
                },
            },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
                insurancePolicies: { include: INSURANCE_INCLUDE },
            },
        });
        res.status(201).json({
            success: true,
            data: {
                ...patient,
                createdAt: Number(patient.createdAt),
                updatedAt: Number(patient.updatedAt),
                dateOfBirth: Number(patient.dateOfBirth),
                ssn: patient.ssn ? '***-**-' + patient.ssn.slice(-4) : null,
                insurancePolicies: patient.insurancePolicies?.map(serializePolicy),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.createPatient = createPatient;
// ─── Update patient ───────────────────────────────────────────────────────────
const updatePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const { prefix, firstName, middleName, lastName, suffix, dateOfBirth, gender, ssn, phone, email, address, city, state, zipCode, source, } = req.body;
        const now = BigInt(Math.floor(Date.now() / 1000));
        const existingPatient = await prisma.patient.findUnique({ where: { id } });
        if (!existingPatient || existingPatient.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PATIENT'), 'Cannot update patients outside your organization or patient not found');
            return;
        }
        const patient = await prisma.patient.update({
            where: { id },
            data: {
                ...(prefix !== undefined ? { prefix } : {}),
                ...(firstName !== undefined ? { firstName } : {}),
                ...(middleName !== undefined ? { middleName } : {}),
                ...(lastName !== undefined ? { lastName } : {}),
                ...(suffix !== undefined ? { suffix } : {}),
                ...(dateOfBirth ? { dateOfBirth: BigInt(dateOfBirth) } : {}),
                ...(gender !== undefined ? { gender } : {}),
                ...(ssn !== undefined ? { ssn } : {}),
                ...(phone !== undefined ? { phone } : {}),
                ...(email !== undefined ? { email } : {}),
                ...((address !== undefined || city !== undefined || state !== undefined || zipCode !== undefined) ? {
                    address: {
                        street: address ?? null,
                        city: city ?? null,
                        state: state ?? null,
                        zipCode: zipCode ?? null,
                    },
                } : {}),
                ...(source !== undefined ? { source } : {}),
                updatedById: req.user.userId,
                updatedAt: now,
            },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
                insurancePolicies: { include: INSURANCE_INCLUDE },
            },
        });
        res.status(200).json({
            success: true,
            data: {
                ...patient,
                createdAt: Number(patient.createdAt),
                updatedAt: Number(patient.updatedAt),
                dateOfBirth: Number(patient.dateOfBirth),
                ssn: patient.ssn ? '***-**-' + patient.ssn.slice(-4) : null,
                insurancePolicies: patient.insurancePolicies?.map(serializePolicy),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.updatePatient = updatePatient;
// ─── Delete patient ───────────────────────────────────────────────────────────
const deletePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const existingPatient = await prisma.patient.findUnique({ where: { id } });
        if (!existingPatient || existingPatient.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PATIENT'), 'Cannot delete patients outside your organization or patient not found');
            return;
        }
        const [visitCount, claimCount, insuranceCount] = await prisma.$transaction([
            prisma.visit.count({ where: { patientId: id } }),
            prisma.claim.count({ where: { patientId: id } }),
            prisma.patientInsurance.count({ where: { patientId: id } }),
        ]);
        if (visitCount > 0 || claimCount > 0 || insuranceCount > 0) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.deleteFailed)('PATIENT'), 'Patient has dependent records and cannot be deleted');
            return;
        }
        await prisma.patient.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.deletePatient = deletePatient;
