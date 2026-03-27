"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runEligibilityCheck = runEligibilityCheck;
exports.getEligibilityChecks = getEligibilityChecks;
exports.getEligibilityCheckById = getEligibilityCheckById;
const prisma_1 = require("../../generated/prisma");
const stedi_service_1 = require("../services/stedi.service");
const stedi_service_2 = require("../services/stedi.service");
const prisma = new prisma_1.PrismaClient();
/**
 * POST /api/eligibility/check
 * Trigger a real-time eligibility check (270/271) for a patient insurance record.
 * Body: { patientInsuranceId, visitId? }
 */
async function runEligibilityCheck(req, res) {
    try {
        const { patientInsuranceId, visitId } = req.body;
        const organizationId = req.user?.organizationId;
        if (!patientInsuranceId) {
            res.status(400).json({ error: 'patientInsuranceId is required' });
            return;
        }
        if (!organizationId) {
            res.status(401).json({ error: 'Organization context is required' });
            return;
        }
        const result = await (0, stedi_service_1.checkEligibility)(patientInsuranceId, organizationId, visitId);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (e) {
        if (e instanceof stedi_service_2.StediError) {
            res.status(e.statusCode).json({
                error: e.code,
                message: e.message,
                raw: e.raw,
            });
        }
        else {
            console.error('Eligibility check error:', e);
            res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
        }
    }
}
/**
 * GET /api/eligibility
 * List eligibility checks for the org, optionally filtered by patientId or visitId.
 * Query: { patientId?, visitId?, limit?, offset? }
 */
async function getEligibilityChecks(req, res) {
    try {
        const organizationId = req.user?.organizationId;
        const { patientId, visitId, patientInsuranceId, limit = '20', offset = '0' } = req.query;
        const where = { organizationId };
        if (patientId)
            where.patientId = patientId;
        if (visitId)
            where.visitId = visitId;
        if (patientInsuranceId)
            where.patientInsuranceId = patientInsuranceId;
        const [items, total] = await Promise.all([
            prisma.eligibilityCheck.findMany({
                where,
                orderBy: { requestedAt: 'desc' },
                take: parseInt(limit),
                skip: parseInt(offset),
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true } },
                    patientInsurance: {
                        include: {
                            plan: {
                                include: {
                                    payor: { select: { id: true, name: true } },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.eligibilityCheck.count({ where }),
        ]);
        res.status(200).json({ data: items, total, limit: parseInt(limit), offset: parseInt(offset) });
    }
    catch (e) {
        console.error('Get eligibility checks error:', e);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
    }
}
/**
 * GET /api/eligibility/:id
 * Get a single eligibility check by ID.
 */
async function getEligibilityCheckById(req, res) {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const check = await prisma.eligibilityCheck.findFirst({
            where: { id, organizationId },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true } },
                patientInsurance: {
                    include: {
                        plan: {
                            include: {
                                payor: true,
                            },
                        },
                    },
                },
            },
        });
        if (!check) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Eligibility check not found' });
            return;
        }
        res.status(200).json({ data: check });
    }
    catch (e) {
        console.error('Get eligibility check error:', e);
        res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
    }
}
