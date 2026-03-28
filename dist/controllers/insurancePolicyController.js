"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInsurancePolicy = exports.updateInsurancePolicy = exports.createInsurancePolicy = exports.getInsurancePolicyById = exports.getInsurancePolicies = void 0;
const prisma_1 = require("../../generated/prisma");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new prisma_1.PrismaClient();
// ─── Shared include ───────────────────────────────────────────────────────────
const POLICY_INCLUDE = {
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
// ─── Serialiser: convert BigInt fields to Number for JSON ────────────────────
function serializePolicy(p) {
    return {
        ...p,
        subscriberDob: p.subscriberDob != null ? Number(p.subscriberDob) : null,
        createdAt: Number(p.createdAt),
        updatedAt: Number(p.updatedAt),
        dependents: (p.dependents ?? []).map((d) => ({
            ...d,
            dateOfBirth: d.dateOfBirth != null ? Number(d.dateOfBirth) : null,
            createdAt: Number(d.createdAt),
            updatedAt: Number(d.updatedAt),
        })),
    };
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Validate and normalise a raw dependent from the request body.
 * dateOfBirth is accepted as a Unix timestamp (number/string) — same convention
 * as Patient.dateOfBirth.  Returns null if the entry is invalid.
 */
function parseDependent(raw, index) {
    if (!raw || typeof raw !== 'object')
        return null;
    const firstName = (raw.firstName ?? '').trim();
    const lastName = (raw.lastName ?? '').trim();
    if (!firstName || !lastName)
        return null;
    let dateOfBirth;
    if (raw.dateOfBirth != null && raw.dateOfBirth !== '') {
        const ts = Number(raw.dateOfBirth);
        if (!isNaN(ts))
            dateOfBirth = BigInt(Math.floor(ts));
    }
    return {
        firstName,
        lastName,
        ...(dateOfBirth !== undefined ? { dateOfBirth } : {}),
        ...(raw.relationship ? { relationship: String(raw.relationship) } : {}),
    };
}
// ─── List ─────────────────────────────────────────────────────────────────────
const getInsurancePolicies = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { patientId, payorId, isPrimary } = req.query;
        const where = {};
        if (patientId && typeof patientId === 'string')
            where.patientId = patientId;
        if (payorId && typeof payorId === 'string') {
            // Match on direct payorId OR via plan
            where.OR = [
                { payorId },
                { plan: { payor: { id: payorId } } },
            ];
        }
        if (isPrimary !== undefined)
            where.isPrimary = isPrimary === 'true';
        const [policies, total] = await prisma.$transaction([
            prisma.patientInsurance.findMany({ where, skip, take: limit, include: POLICY_INCLUDE }),
            prisma.patientInsurance.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: policies.map(serializePolicy),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.getInsurancePolicies = getInsurancePolicies;
// ─── Get by ID ────────────────────────────────────────────────────────────────
const getInsurancePolicyById = async (req, res) => {
    try {
        const { id } = req.params;
        const policy = await prisma.patientInsurance.findUnique({
            where: { id },
            include: POLICY_INCLUDE,
        });
        if (!policy) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('INSURANCE_POLICY'), 'Insurance policy not found');
            return;
        }
        res.status(200).json({ success: true, data: serializePolicy(policy) });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.getInsurancePolicyById = getInsurancePolicyById;
// ─── Create ───────────────────────────────────────────────────────────────────
const createInsurancePolicy = async (req, res) => {
    try {
        const { patientId, planId, payorId, isPrimary, insuredType, subscriberName, subscriberDob, memberId, dependents: rawDependents, } = req.body;
        const now = BigInt(Math.floor(Date.now() / 1000));
        if (!patientId || isPrimary === undefined || !insuredType || !memberId) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('INSURANCE_POLICY'), 'Missing required fields: patientId, isPrimary, insuredType, memberId');
            return;
        }
        const [patient, plan] = await Promise.all([
            prisma.patient.findUnique({ where: { id: patientId } }),
            planId ? prisma.payorPlan.findUnique({ where: { id: planId } }) : Promise.resolve(null),
        ]);
        if (!patient) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PATIENT'), 'Patient not found');
            return;
        }
        if (planId && !plan) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PAYOR_PLAN'), 'Payor plan not found');
            return;
        }
        // Derive payorId: explicit > from plan > null
        const resolvedPayorId = payorId ?? plan?.payorId ?? null;
        // Parse dependents array (ignore malformed entries)
        const parsedDependents = Array.isArray(rawDependents)
            ? rawDependents.map(parseDependent).filter(Boolean)
            : [];
        const policy = await prisma.patientInsurance.create({
            data: {
                patientId,
                planId: planId ?? null,
                payorId: resolvedPayorId,
                isPrimary,
                insuredType,
                subscriberName: subscriberName ?? null,
                subscriberDob: subscriberDob != null ? BigInt(Math.floor(Number(subscriberDob))) : undefined,
                memberId,
                createdAt: now,
                updatedAt: now,
                dependents: parsedDependents.length > 0
                    ? {
                        create: parsedDependents.map(d => ({
                            ...d,
                            createdAt: now,
                            updatedAt: now,
                        })),
                    }
                    : undefined,
            },
            include: POLICY_INCLUDE,
        });
        res.status(201).json({ success: true, data: serializePolicy(policy) });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.createInsurancePolicy = createInsurancePolicy;
// ─── Update ───────────────────────────────────────────────────────────────────
// Dependents are replaced wholesale when provided.
// If `dependents` key is absent from the body, existing dependents are untouched.
// If `dependents` is an empty array, all dependents are removed.
const updateInsurancePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const { isPrimary, insuredType, subscriberName, subscriberDob, memberId, planId, payorId, dependents: rawDependents, } = req.body;
        const now = BigInt(Math.floor(Date.now() / 1000));
        const existing = await prisma.patientInsurance.findUnique({ where: { id } });
        if (!existing) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('INSURANCE_POLICY'), 'Insurance policy not found');
            return;
        }
        // If planId is being set, resolve its payorId for the direct field too
        let resolvedPayorId = undefined;
        if (payorId !== undefined) {
            resolvedPayorId = payorId ?? null;
        }
        else if (planId !== undefined) {
            if (planId) {
                const plan = await prisma.payorPlan.findUnique({ where: { id: planId } });
                resolvedPayorId = plan?.payorId ?? null;
            }
            else {
                resolvedPayorId = null;
            }
        }
        // Build dependents mutation only if the key was explicitly sent
        let dependentsMutation = undefined;
        if ('dependents' in req.body) {
            const parsed = Array.isArray(rawDependents)
                ? rawDependents.map(parseDependent).filter(Boolean)
                : [];
            dependentsMutation = {
                // Delete all existing dependents then recreate
                deleteMany: {},
                create: parsed.map(d => ({ ...d, createdAt: now, updatedAt: now })),
            };
        }
        const policy = await prisma.patientInsurance.update({
            where: { id },
            data: {
                ...(isPrimary !== undefined ? { isPrimary } : {}),
                ...(insuredType !== undefined ? { insuredType } : {}),
                ...(subscriberName !== undefined ? { subscriberName } : {}),
                ...(subscriberDob != null
                    ? { subscriberDob: BigInt(Math.floor(Number(subscriberDob))) }
                    : subscriberDob === null ? { subscriberDob: null } : {}),
                ...(memberId !== undefined ? { memberId } : {}),
                ...(planId !== undefined ? { planId: planId ?? null } : {}),
                ...(resolvedPayorId !== undefined ? { payorId: resolvedPayorId } : {}),
                ...(dependentsMutation ? { dependents: dependentsMutation } : {}),
                updatedAt: now,
            },
            include: POLICY_INCLUDE,
        });
        res.status(200).json({ success: true, data: serializePolicy(policy) });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.updateInsurancePolicy = updateInsurancePolicy;
// ─── Delete ───────────────────────────────────────────────────────────────────
const deleteInsurancePolicy = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.patientInsurance.findUnique({ where: { id } });
        if (!existing) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('INSURANCE_POLICY'), 'Insurance policy not found');
            return;
        }
        await prisma.patientInsurance.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'INSURANCE_POLICY');
    }
};
exports.deleteInsurancePolicy = deleteInsurancePolicy;
