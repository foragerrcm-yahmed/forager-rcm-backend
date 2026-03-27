"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteClaim = exports.deletePaymentPosting = exports.postPatientPayment = exports.updateClaimStatus = exports.updateClaim = exports.createClaim = exports.getClaimById = exports.getClaims = void 0;
const prisma_1 = require("../../generated/prisma");
const claimStatusService_1 = require("../services/claimStatusService");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const bigint_1 = require("../utils/bigint");
const prisma = new prisma_1.PrismaClient();
const getClaims = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, patientId, providerId, payorId, status, dateFrom, dateTo, amountMin, amountMax, source, includeServices, includeTimeline } = req.query;
        const where = {
            organizationId: req.user?.organizationId,
        };
        if (search && typeof search === 'string') {
            where.OR = [
                { claimNumber: { contains: search, mode: 'insensitive' } },
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
        if (payorId && typeof payorId === 'string') {
            where.payorId = payorId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (dateFrom || dateTo) {
            where.serviceDate = {};
            if (dateFrom)
                where.serviceDate.gte = BigInt(dateFrom);
            if (dateTo)
                where.serviceDate.lte = BigInt(dateTo);
        }
        if (amountMin || amountMax) {
            where.billedAmount = {};
            if (amountMin)
                where.billedAmount.gte = parseFloat(amountMin);
            if (amountMax)
                where.billedAmount.lte = parseFloat(amountMax);
        }
        if (source && typeof source === 'string') {
            where.source = source;
        }
        const include = {
            patient: { select: { id: true, firstName: true, lastName: true } },
            provider: { select: { id: true, firstName: true, lastName: true } },
            payor: { select: { id: true, name: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
            updatedBy: { select: { id: true, firstName: true, lastName: true } },
        };
        if (includeServices === 'true') {
            include.services = true;
        }
        if (includeTimeline === 'true') {
            include.timeline = true;
        }
        const [claims, total] = await prisma.$transaction([
            prisma.claim.findMany({
                where,
                skip,
                take: limit,
                include,
            }),
            prisma.claim.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: (0, bigint_1.convertBigIntToNumber)(claims),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CLAIM');
    }
};
exports.getClaims = getClaims;
const getClaimById = async (req, res) => {
    try {
        const { id } = req.params;
        const claim = await prisma.claim.findUnique({
            where: { id: id, organizationId: req.user?.organizationId },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, dateOfBirth: true, phone: true, email: true } },
                provider: { select: { id: true, firstName: true, lastName: true, specialty: true } },
                payor: { select: { id: true, name: true } },
                visit: {
                    select: {
                        id: true, visitDate: true, visitType: true, location: true, status: true,
                        diagnoses: { orderBy: { sequence: 'asc' } },
                    }
                },
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
                services: true,
                timeline: true,
                diagnoses: { orderBy: { sequence: 'asc' } },
            }
        });
        if (!claim) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('CLAIM'), 'Claim not found');
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                ...claim,
                serviceDate: Number(claim.serviceDate),
                submissionDate: claim.submissionDate ? Number(claim.submissionDate) : null,
                creationDate: Number(claim.creationDate),
                createdAt: Number(claim.createdAt),
                updatedAt: Number(claim.updatedAt),
                billedAmount: Number(claim.billedAmount),
                allowedAmount: claim.allowedAmount ? Number(claim.allowedAmount) : null,
                paidAmount: claim.paidAmount ? Number(claim.paidAmount) : null,
                adjustmentAmount: claim.adjustmentAmount ? Number(claim.adjustmentAmount) : null,
                patientResponsibility: claim.patientResponsibility ? Number(claim.patientResponsibility) : null,
                patient: claim.patient ? {
                    ...claim.patient,
                    dateOfBirth: Number(claim.patient.dateOfBirth),
                } : null,
                visit: claim.visit ? {
                    ...claim.visit,
                    visitDate: Number(claim.visit.visitDate),
                } : null,
                services: claim.services?.map((s) => ({
                    ...s,
                    unitPrice: Number(s.unitPrice),
                    totalPrice: Number(s.totalPrice),
                    contractedRate: s.contractedRate ? Number(s.contractedRate) : null,
                    createdAt: Number(s.createdAt),
                })),
                timeline: claim.timeline?.map((t) => ({
                    ...t,
                    createdAt: Number(t.createdAt),
                })),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CLAIM');
    }
};
exports.getClaimById = getClaimById;
const createClaim = async (req, res) => {
    try {
        const { claimNumber, patientId, providerId, payorId, organizationId, visitId, serviceDate, billedAmount, paidAmount, status, notes, source, submissionDate, services } = req.body;
        if (!claimNumber || !patientId || !providerId || !payorId || !organizationId || !serviceDate || billedAmount === undefined || !status || !source) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('CLAIM'), 'Missing required claim fields');
            return;
        }
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('CLAIM'), 'Cannot create claims outside your organization');
            return;
        }
        const existingClaim = await prisma.claim.findFirst({ where: { claimNumber, organizationId: organizationId } });
        if (existingClaim) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('CLAIM'), 'Claim with this number already exists in this organization');
            return;
        }
        const [patient, provider, payor] = await prisma.$transaction([
            prisma.patient.findUnique({ where: { id: patientId } }),
            prisma.provider.findUnique({ where: { id: providerId } }),
            prisma.payor.findUnique({ where: { id: payorId } }),
        ]);
        if (!patient || patient.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('PATIENT'), 'Patient not found');
            return;
        }
        if (!provider || provider.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('PROVIDER'), 'Provider not found');
            return;
        }
        if (!payor || payor.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('PAYOR'), 'Payor not found');
            return;
        }
        const now = Math.floor(Date.now() / 1000);
        const claim = await prisma.claim.create({
            data: {
                claimNumber,
                patient: { connect: { id: patientId } },
                provider: { connect: { id: providerId } },
                payor: { connect: { id: payorId } },
                organization: { connect: { id: organizationId } },
                visit: visitId ? { connect: { id: visitId } } : undefined,
                serviceDate: BigInt(serviceDate),
                billedAmount,
                paidAmount: paidAmount || 0,
                status,
                notes,
                source,
                submissionDate: submissionDate ? BigInt(submissionDate) : null,
                createdBy: { connect: { id: req.user.userId } },
                updatedBy: { connect: { id: req.user.userId } },
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
                ...(services && services.length > 0 ? {
                    services: {
                        create: services.map((s) => ({
                            ...(s.cptCode ? { cptCode: { connect: { code: s.cptCode } } } : {}),
                            description: s.description || null,
                            quantity: s.quantity,
                            unitPrice: s.unitPrice,
                            totalPrice: s.totalPrice,
                            createdAt: BigInt(now),
                        })),
                    },
                } : {}),
                timeline: {
                    create: [{
                            action: 'Created',
                            status,
                            notes: `Claim created with status: ${status}`,
                            createdAt: BigInt(now),
                        }],
                },
            },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
                services: true,
                timeline: true,
            }
        });
        res.status(201).json({
            success: true,
            data: {
                ...claim,
                serviceDate: Number(claim.serviceDate),
                submissionDate: claim.submissionDate ? Number(claim.submissionDate) : null,
                createdAt: Number(claim.createdAt),
                updatedAt: Number(claim.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CLAIM');
    }
};
exports.createClaim = createClaim;
const updateClaim = async (req, res) => {
    try {
        const { id } = req.params;
        const { serviceDate, billedAmount, paidAmount, status, notes, source, submissionDate, services } = req.body;
        const now = Math.floor(Date.now() / 1000);
        const existingClaim = await prisma.claim.findUnique({ where: { id: id } });
        if (!existingClaim || existingClaim.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('CLAIM'), 'Cannot update claims outside your organization or claim not found');
            return;
        }
        if (services) {
            await prisma.claimService.deleteMany({ where: { claimId: id } });
        }
        const claim = await prisma.claim.update({
            where: { id: id },
            data: {
                serviceDate: serviceDate ? BigInt(serviceDate) : undefined,
                billedAmount,
                paidAmount,
                status,
                notes,
                source,
                submissionDate: submissionDate ? BigInt(submissionDate) : undefined,
                updatedBy: { connect: { id: req.user.userId } },
                updatedAt: BigInt(now),
                services: services ? {
                    create: services.map((s) => ({
                        ...(s.cptCode ? { cptCode: { connect: { code: s.cptCode } } } : {}),
                        description: s.description || null,
                        quantity: s.quantity,
                        unitPrice: s.unitPrice,
                        totalPrice: s.totalPrice,
                        createdAt: BigInt(now),
                    })),
                } : undefined,
            },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
                services: true,
                timeline: true,
            }
        });
        res.status(200).json({
            success: true,
            data: {
                ...claim,
                serviceDate: Number(claim.serviceDate),
                submissionDate: claim.submissionDate ? Number(claim.submissionDate) : null,
                createdAt: Number(claim.createdAt),
                updatedAt: Number(claim.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CLAIM');
    }
};
exports.updateClaim = updateClaim;
const updateClaimStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const now = Math.floor(Date.now() / 1000);
        if (!status) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('CLAIM'), 'Status is required');
            return;
        }
        const existingClaim = await prisma.claim.findUnique({ where: { id: id } });
        if (!existingClaim || existingClaim.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('CLAIM'), 'Cannot update claims outside your organization or claim not found');
            return;
        }
        const claim = await prisma.claim.update({
            where: { id: id },
            data: {
                status,
                updatedBy: { connect: { id: req.user.userId } },
                updatedAt: BigInt(now),
                timeline: {
                    create: {
                        action: 'Status Updated',
                        status,
                        notes: notes || `Status updated to: ${status}`,
                        createdAt: BigInt(now),
                    },
                },
            },
            include: {
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
                services: true,
                timeline: true,
            }
        });
        res.status(200).json({
            success: true,
            data: {
                ...claim,
                serviceDate: Number(claim.serviceDate),
                submissionDate: claim.submissionDate ? Number(claim.submissionDate) : null,
                createdAt: Number(claim.createdAt),
                updatedAt: Number(claim.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CLAIM');
    }
};
exports.updateClaimStatus = updateClaimStatus;
/**
 * POST /claims/:id/payment
 * Post a patient payment against a claim and recalculate its status.
 * Body: { amount: number, paymentMethod?: string, notes?: string }
 */
const postPatientPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, paymentMethod, notes } = req.body;
        const now = Math.floor(Date.now() / 1000);
        if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('CLAIM'), 'A positive payment amount is required');
            return;
        }
        const existingClaim = await prisma.claim.findUnique({
            where: { id: id },
            include: { payor: { select: { payorCategory: true } } },
        });
        if (!existingClaim || existingClaim.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('CLAIM'), 'Claim not found or outside your organization');
            return;
        }
        // Create a PaymentPosting record for the patient payment
        await prisma.paymentPosting.create({
            data: {
                claimId: id,
                organizationId: req.user.organizationId,
                payerName: 'Patient',
                billedAmount: existingClaim.billedAmount,
                paidAmount: Number(amount),
                isAutoPosted: false,
                postedById: req.user.userId,
                postedAt: new Date(),
            },
        });
        // Recalculate and persist the new claim status
        const newStatus = await (0, claimStatusService_1.applyClaimStatusRecalculation)(id, req.user.userId, now);
        // Add a timeline entry
        await prisma.claimTimeline.create({
            data: {
                claimId: id,
                action: 'Patient Payment Posted',
                notes: `$${Number(amount).toFixed(2)} received from patient${notes ? ` — ${notes}` : ''}. Status updated to ${newStatus}.`,
                status: newStatus,
                createdAt: BigInt(now),
                userId: req.user.userId,
            },
        });
        res.status(200).json({
            success: true,
            data: {
                claimId: id,
                amountPosted: Number(amount),
                newStatus,
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CLAIM');
    }
};
exports.postPatientPayment = postPatientPayment;
/**
 * DELETE /claims/:id/payment/:paymentId
 * Delete a payment posting and recalculate the claim status.
 */
const deletePaymentPosting = async (req, res) => {
    try {
        const { id, paymentId } = req.params;
        const now = Math.floor(Date.now() / 1000);
        // Verify the posting belongs to this claim and org
        const posting = await prisma.paymentPosting.findUnique({
            where: { id: paymentId },
        });
        if (!posting || posting.claimId !== id || posting.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('PAYMENT_POSTING'), 'Payment posting not found');
            return;
        }
        await prisma.paymentPosting.delete({ where: { id: paymentId } });
        // Recalculate claim status now that this payment is removed
        const newStatus = await (0, claimStatusService_1.applyClaimStatusRecalculation)(id, req.user.userId, now);
        // Timeline entry
        await prisma.claimTimeline.create({
            data: {
                claimId: id,
                action: 'Payment Deleted',
                notes: `Payment of $${Number(posting.paidAmount).toFixed(2)} from ${posting.payerName ?? 'unknown'} was removed. Status recalculated to ${newStatus}.`,
                status: newStatus ?? undefined,
                createdAt: BigInt(now),
                userId: req.user.userId,
            },
        });
        res.status(200).json({
            success: true,
            data: { claimId: id, deletedPaymentId: paymentId, newStatus },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PAYMENT_POSTING');
    }
};
exports.deletePaymentPosting = deletePaymentPosting;
const deleteClaim = async (req, res) => {
    try {
        const { id } = req.params;
        const existingClaim = await prisma.claim.findUnique({ where: { id: id } });
        if (!existingClaim || existingClaim.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('CLAIM'), 'Cannot delete claims outside your organization or claim not found');
            return;
        }
        await prisma.claim.delete({ where: { id: id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CLAIM');
    }
};
exports.deleteClaim = deleteClaim;
