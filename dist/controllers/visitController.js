"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteVisit = exports.updateVisit = exports.createVisit = exports.getVisitById = exports.getVisits = void 0;
const client_1 = require("@prisma/client");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
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
                    createdBy: { select: { id: true, firstName: true, lastName: true } },
                    updatedBy: { select: { id: true, firstName: true, lastName: true } },
                }
            }),
            prisma.visit.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: visits.map(v => ({
                ...v,
                visitDate: Number(v.visitDate),
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
                createdBy: { select: { id: true, firstName: true, lastName: true } },
                updatedBy: { select: { id: true, firstName: true, lastName: true } },
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
                createdAt: Number(visit.createdAt),
                updatedAt: Number(visit.updatedAt),
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
