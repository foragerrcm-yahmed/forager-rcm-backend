"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVisit = exports.updateVisit = exports.createVisit = exports.getVisitById = exports.getVisits = void 0;
exports.shouldRecheckEligibility = shouldRecheckEligibility;
const client_1 = require("@prisma/client");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const stediService = __importStar(require("../services/stedi.service"));
const prisma = new client_1.PrismaClient();
const getVisits = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, patientId, providerId, status, dateFrom, dateTo, source } = req.query;
        const where = {
            organizationId: req.user?.organizationId,
        };
        if (search && typeof search === 'string') {
            where.OR = [
                { notes: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (organizationId && typeof organizationId === 'string') {
            where.organizationId = organizationId;
        }
        if (patientId && typeof patientId === 'string') {
            where.patientId = patientId;
        }
        if (providerId && typeof providerId === 'string') {
            where.providerId = providerId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (dateFrom || dateTo) {
            where.visitDate = {};
            if (dateFrom)
                where.visitDate.gte = BigInt(dateFrom);
            if (dateTo)
                where.visitDate.lte = BigInt(dateTo);
        }
        if (source && typeof source === 'string') {
            where.source = source;
        }
        const [visits, total] = await prisma.$transaction([
            prisma.visit.findMany({
                where,
                skip,
                take: limit,
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true } },
                    provider: { select: { id: true, firstName: true, lastName: true } },
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    updatedBy: { select: { id: true, firstName: true, lastName: true } },
                    claims: { select: { id: true, claimNumber: true, status: true, billedAmount: true } },
                }
            }),
            prisma.visit.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: visits.map(v => ({
                ...v,
                visitDate: Number(v.visitDate),
                visitTime: Number(v.visitTime),
                createdAt: Number(v.createdAt),
                updatedAt: Number(v.updatedAt),
            })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'VISIT');
    }
};
exports.getVisits = getVisits;
const getVisitById = async (req, res) => {
    try {
        const { id } = req.params;
        const visit = await prisma.visit.findUnique({
            where: { id: id, organizationId: req.user?.organizationId },
            include: {
                patient: {
                    select: {
                        id: true, firstName: true, lastName: true, dateOfBirth: true, phone: true, email: true,
                        insurancePolicies: {
                            include: {
                                plan: {
                                    include: {
                                        payor: { select: { id: true, name: true } },
                                    }
                                }
                            }
                        }
                    }
                },
                provider: { select: { id: true, firstName: true, lastName: true, specialty: true, licenseType: true } },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
                claims: {
                    include: {
                        payor: { select: { id: true, name: true } },
                        services: true,
                    }
                },
            }
        });
        if (!visit) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('VISIT'), 'Visit not found');
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                ...visit,
                visitDate: Number(visit.visitDate),
                visitTime: Number(visit.visitTime),
                createdAt: Number(visit.createdAt),
                updatedAt: Number(visit.updatedAt),
                patient: visit.patient ? {
                    ...visit.patient,
                    dateOfBirth: Number(visit.patient.dateOfBirth),
                } : null,
                claims: visit.claims?.map((c) => ({
                    ...c,
                    billedAmount: Number(c.billedAmount),
                    allowedAmount: c.allowedAmount ? Number(c.allowedAmount) : null,
                    paidAmount: c.paidAmount ? Number(c.paidAmount) : null,
                    serviceDate: Number(c.serviceDate),
                    submissionDate: c.submissionDate ? Number(c.submissionDate) : null,
                    creationDate: Number(c.creationDate),
                })),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'VISIT');
    }
};
exports.getVisitById = getVisitById;
const createVisit = async (req, res) => {
    try {
        const { patientId, providerId, organizationId, visitDate, visitTime, duration, visitType, location, status, notes, source } = req.body;
        if (!patientId || !providerId || !organizationId || !visitDate || !visitTime || duration === undefined || !visitType || !status || !source) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('VISIT'), 'Missing required visit fields');
            return;
        }
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('VISIT'), 'Cannot create visits outside your organization');
            return;
        }
        const [patient, provider] = await prisma.$transaction([
            prisma.patient.findUnique({ where: { id: patientId } }),
            prisma.provider.findUnique({ where: { id: providerId } }),
        ]);
        if (!patient || patient.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('PATIENT'), 'Patient not found');
            return;
        }
        if (!provider || provider.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('PROVIDER'), 'Provider not found');
            return;
        }
        const now = Math.floor(Date.now() / 1000);
        const visit = await prisma.visit.create({
            data: {
                patient: { connect: { id: patientId } },
                provider: { connect: { id: providerId } },
                organization: { connect: { id: organizationId } },
                visitDate: BigInt(visitDate),
                visitTime: BigInt(visitTime),
                duration,
                visitType,
                location,
                status,
                notes,
                source,
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
                ...visit,
                visitDate: Number(visit.visitDate),
                createdAt: Number(visit.createdAt),
                updatedAt: Number(visit.updatedAt),
            },
        });
        // Auto-trigger eligibility check when a visit is created with Upcoming status
        // Fire-and-forget: does not block the response
        if (status === 'Upcoming') {
            setImmediate(async () => {
                try {
                    // Fetch patient's primary insurance
                    const primaryInsurance = await prisma.patientInsurance.findFirst({
                        where: { patientId: patientId, isPrimary: true },
                        include: {
                            plan: { include: { payor: true } },
                        },
                    });
                    if (!primaryInsurance)
                        return;
                    // Check if we should recheck eligibility using the shouldRecheckEligibility logic
                    const lastCheck = await prisma.eligibilityCheck.findFirst({
                        where: { patientInsuranceId: primaryInsurance.id },
                        orderBy: { createdAt: 'desc' },
                    });
                    // Adapt lastCheck.createdAt (Date) to the bigint shape expected by shouldRecheckEligibility
                    const lastCheckAdapted = lastCheck
                        ? { createdAt: BigInt(Math.floor(lastCheck.createdAt.getTime() / 1000)) }
                        : null;
                    const shouldRecheck = shouldRecheckEligibility({ visitDate: BigInt(visitDate), visitType }, lastCheckAdapted, primaryInsurance.planYearStartMonth ?? 1);
                    if (!shouldRecheck)
                        return;
                    await stediService.checkEligibility(primaryInsurance.id, visit.id);
                }
                catch (e) {
                    // Log but do not fail — eligibility check is best-effort
                    console.error('[auto-eligibility] Error during auto-check for visit', visit.id, e);
                }
            });
        }
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'VISIT');
    }
};
exports.createVisit = createVisit;
const updateVisit = async (req, res) => {
    try {
        const { id } = req.params;
        const { visitDate, visitType, location, status, notes, source } = req.body;
        const now = Math.floor(Date.now() / 1000);
        const existingVisit = await prisma.visit.findUnique({ where: { id: id } });
        if (!existingVisit || existingVisit.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('VISIT'), 'Cannot update visits outside your organization or visit not found');
            return;
        }
        const visit = await prisma.visit.update({
            where: { id: id },
            data: {
                visitDate: visitDate ? BigInt(visitDate) : undefined,
                visitType,
                location,
                status,
                notes,
                source,
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
                ...visit,
                visitDate: Number(visit.visitDate),
                createdAt: Number(visit.createdAt),
                updatedAt: Number(visit.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'VISIT');
    }
};
exports.updateVisit = updateVisit;
const deleteVisit = async (req, res) => {
    try {
        const { id } = req.params;
        const existingVisit = await prisma.visit.findUnique({ where: { id: id } });
        if (!existingVisit || existingVisit.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('VISIT'), 'Cannot delete visits outside your organization or visit not found');
            return;
        }
        const claimCount = await prisma.claim.count({ where: { visitId: id } });
        if (claimCount > 0) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.deleteFailed)('VISIT'), 'Visit has dependent claims and cannot be deleted');
            return;
        }
        await prisma.visit.delete({ where: { id: id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'VISIT');
    }
};
exports.deleteVisit = deleteVisit;
// ─── Eligibility Recheck Logic ───────────────────────────────────────────────
// Determines whether a new eligibility check should be triggered for a visit.
// This is the canonical implementation of the shouldRecheckEligibility function.
function differenceInDays(a, b) {
    return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}
function crossesPlanYearReset(lastCheckDate, appointmentDate, planYearStartMonth = 1) {
    // planYearStartMonth: 1 = January (calendar year), 7 = July, etc.
    // A "plan year" runs from planYearStartMonth of year N through planYearStartMonth-1 of year N+1.
    // We check whether lastCheckDate and appointmentDate fall in different plan years.
    const planYearOf = (d) => {
        const month = d.getMonth() + 1; // 1-12
        const year = d.getFullYear();
        // If we're before the start month, we're still in the previous plan year
        return month >= planYearStartMonth ? year : year - 1;
    };
    return planYearOf(lastCheckDate) !== planYearOf(appointmentDate);
}
function isTherapyVisit(visit) {
    // PT, OT, SLP, and mental health visits have per-visit benefit limits that
    // change with every claim — always recheck.
    const therapyTypes = ['PhysicalTherapy', 'OccupationalTherapy', 'SpeechTherapy', 'MentalHealth', 'BehavioralHealth'];
    return therapyTypes.includes(visit.visitType);
}
function shouldRecheckEligibility(visit, lastCheck, planYearStartMonth = 1 // 1-12; default January (calendar year)
) {
    if (!lastCheck)
        return true;
    const appointmentDate = new Date(Number(visit.visitDate) * 1000);
    const lastCheckDate = new Date(Number(lastCheck.createdAt) * 1000);
    const today = new Date();
    const daysSinceCheck = differenceInDays(today, lastCheckDate);
    const daysUntilAppointment = differenceInDays(appointmentDate, today);
    // Always recheck if appointment crosses a plan year boundary
    if (crossesPlanYearReset(lastCheckDate, appointmentDate, planYearStartMonth))
        return true;
    // Always recheck PT/rehab — therapy visit counts change with every claim
    if (isTherapyVisit({ visitType: visit.visitType }))
        return true;
    // If appointment is today or tomorrow and checked within 3 days — skip
    if (daysUntilAppointment <= 1 && daysSinceCheck <= 3)
        return false;
    // If checked within 3 days of the appointment date — skip
    if (daysSinceCheck <= 3)
        return false;
    // Otherwise recheck
    return true;
}
