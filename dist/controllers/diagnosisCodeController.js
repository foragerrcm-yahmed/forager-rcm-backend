"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleCPTCodeActive = exports.removeVisitDiagnosis = exports.updateVisitDiagnosis = exports.addVisitDiagnosis = exports.getVisitDiagnoses = exports.toggleDiagnosisCodeActive = exports.deleteDiagnosisCode = exports.updateDiagnosisCode = exports.createDiagnosisCode = exports.getDiagnosisCodeById = exports.getDiagnosisCodes = void 0;
const client_1 = require("@prisma/client");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new client_1.PrismaClient();
// ─── DiagnosisCode (org-scoped ICD-10 master list) ───────────────────────────
const getDiagnosisCodes = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, category, showInactive } = req.query;
        const organizationId = req.user?.organizationId;
        const where = { organizationId };
        // By default only show active codes; pass showInactive=true to see all
        if (showInactive !== 'true') {
            where.isActive = true;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (category && typeof category === 'string') {
            where.category = { contains: category, mode: 'insensitive' };
        }
        const [codes, total] = await prisma.$transaction([
            prisma.diagnosisCode.findMany({
                where,
                skip,
                take: limit,
                orderBy: { code: 'asc' },
            }),
            prisma.diagnosisCode.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: codes.map(c => ({ ...c, createdAt: Number(c.createdAt), updatedAt: Number(c.updatedAt) })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS_CODE');
    }
};
exports.getDiagnosisCodes = getDiagnosisCodes;
const getDiagnosisCodeById = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const code = await prisma.diagnosisCode.findFirst({
            where: { id, organizationId },
        });
        if (!code) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('DiagnosisCode'), 'Diagnosis code not found');
            return;
        }
        res.status(200).json({ success: true, data: { ...code, createdAt: Number(code.createdAt), updatedAt: Number(code.updatedAt) } });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS_CODE');
    }
};
exports.getDiagnosisCodeById = getDiagnosisCodeById;
const createDiagnosisCode = async (req, res) => {
    try {
        const { code, description, category } = req.body;
        const organizationId = req.user?.organizationId;
        if (!code || !description) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('DIAGNOSIS_CODE'), 'code and description are required');
            return;
        }
        const now = BigInt(Math.floor(Date.now() / 1000));
        const created = await prisma.diagnosisCode.create({
            data: {
                code: code.trim().toUpperCase(),
                description: description.trim(),
                category: category?.trim() || null,
                organizationId,
                isActive: true,
                createdAt: now,
                updatedAt: now,
            },
        });
        res.status(201).json({ success: true, data: { ...created, createdAt: Number(created.createdAt), updatedAt: Number(created.updatedAt) } });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS_CODE');
    }
};
exports.createDiagnosisCode = createDiagnosisCode;
const updateDiagnosisCode = async (req, res) => {
    try {
        const { id } = req.params;
        const { description, category, isActive } = req.body;
        const organizationId = req.user?.organizationId;
        const existing = await prisma.diagnosisCode.findFirst({ where: { id, organizationId } });
        if (!existing) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('DiagnosisCode'), 'Diagnosis code not found');
            return;
        }
        const now = BigInt(Math.floor(Date.now() / 1000));
        const updated = await prisma.diagnosisCode.update({
            where: { id },
            data: {
                ...(description !== undefined && { description: description.trim() }),
                ...(category !== undefined && { category: category?.trim() || null }),
                ...(isActive !== undefined && { isActive }),
                updatedAt: now,
            },
        });
        res.status(200).json({ success: true, data: { ...updated, createdAt: Number(updated.createdAt), updatedAt: Number(updated.updatedAt) } });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS_CODE');
    }
};
exports.updateDiagnosisCode = updateDiagnosisCode;
const deleteDiagnosisCode = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const existing = await prisma.diagnosisCode.findFirst({ where: { id, organizationId } });
        if (!existing) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('DiagnosisCode'), 'Diagnosis code not found');
            return;
        }
        await prisma.diagnosisCode.delete({ where: { id } });
        res.status(200).json({ success: true, message: 'Diagnosis code deleted' });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS_CODE');
    }
};
exports.deleteDiagnosisCode = deleteDiagnosisCode;
// Toggle isActive (hide / reinstate)
const toggleDiagnosisCodeActive = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        const existing = await prisma.diagnosisCode.findFirst({ where: { id, organizationId } });
        if (!existing) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('DiagnosisCode'), 'Diagnosis code not found');
            return;
        }
        const now = BigInt(Math.floor(Date.now() / 1000));
        const updated = await prisma.diagnosisCode.update({
            where: { id },
            data: { isActive: !existing.isActive, updatedAt: now },
        });
        res.status(200).json({ success: true, data: { ...updated, createdAt: Number(updated.createdAt), updatedAt: Number(updated.updatedAt) } });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS_CODE');
    }
};
exports.toggleDiagnosisCodeActive = toggleDiagnosisCodeActive;
// ─── Visit Diagnoses ──────────────────────────────────────────────────────────
const getVisitDiagnoses = async (req, res) => {
    try {
        const { visitId } = req.params;
        const diagnoses = await prisma.diagnosis.findMany({
            where: { visitId },
            orderBy: { sequence: 'asc' },
        });
        res.status(200).json({ success: true, data: diagnoses });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS');
    }
};
exports.getVisitDiagnoses = getVisitDiagnoses;
const addVisitDiagnosis = async (req, res) => {
    try {
        const { visitId } = req.params;
        const { icdCode, description, isPrimary, sequence } = req.body;
        if (!icdCode) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('DIAGNOSIS'), 'icdCode is required');
            return;
        }
        // Verify visit exists
        const visit = await prisma.visit.findUnique({ where: { id: visitId } });
        if (!visit) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('Visit'), 'Visit not found');
            return;
        }
        // If isPrimary, demote any existing primary
        if (isPrimary) {
            await prisma.diagnosis.updateMany({
                where: { visitId, isPrimary: true },
                data: { isPrimary: false },
            });
        }
        // Determine sequence
        const maxSeq = await prisma.diagnosis.aggregate({
            where: { visitId },
            _max: { sequence: true },
        });
        const nextSeq = sequence ?? (maxSeq._max.sequence ?? 0) + 1;
        const created = await prisma.diagnosis.create({
            data: {
                visitId,
                icdCode: icdCode.trim().toUpperCase(),
                description: description?.trim() || null,
                isPrimary: isPrimary ?? false,
                sequence: nextSeq,
            },
        });
        res.status(201).json({ success: true, data: created });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS');
    }
};
exports.addVisitDiagnosis = addVisitDiagnosis;
const updateVisitDiagnosis = async (req, res) => {
    try {
        const { visitId, diagnosisId } = req.params;
        const { icdCode, description, isPrimary, sequence } = req.body;
        const existing = await prisma.diagnosis.findFirst({ where: { id: diagnosisId, visitId } });
        if (!existing) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('Diagnosis'), 'Diagnosis not found');
            return;
        }
        if (isPrimary && !existing.isPrimary) {
            await prisma.diagnosis.updateMany({
                where: { visitId, isPrimary: true },
                data: { isPrimary: false },
            });
        }
        const updated = await prisma.diagnosis.update({
            where: { id: diagnosisId },
            data: {
                ...(icdCode !== undefined && { icdCode: icdCode.trim().toUpperCase() }),
                ...(description !== undefined && { description: description?.trim() || null }),
                ...(isPrimary !== undefined && { isPrimary }),
                ...(sequence !== undefined && { sequence }),
            },
        });
        res.status(200).json({ success: true, data: updated });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS');
    }
};
exports.updateVisitDiagnosis = updateVisitDiagnosis;
const removeVisitDiagnosis = async (req, res) => {
    try {
        const { visitId, diagnosisId } = req.params;
        const existing = await prisma.diagnosis.findFirst({ where: { id: diagnosisId, visitId } });
        if (!existing) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('Diagnosis'), 'Diagnosis not found');
            return;
        }
        await prisma.diagnosis.delete({ where: { id: diagnosisId } });
        res.status(200).json({ success: true, message: 'Diagnosis removed' });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'DIAGNOSIS');
    }
};
exports.removeVisitDiagnosis = removeVisitDiagnosis;
// ─── CPT Code isActive toggle ─────────────────────────────────────────────────
const toggleCPTCodeActive = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await prisma.cPTCode.findUnique({ where: { code: id } });
        if (!existing) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('CPTCode'), 'CPT code not found');
            return;
        }
        const now = BigInt(Math.floor(Date.now() / 1000));
        const updated = await prisma.cPTCode.update({
            where: { code: id },
            data: { isActive: !existing.isActive, updatedAt: now },
        });
        res.status(200).json({ success: true, data: { ...updated, createdAt: Number(updated.createdAt), updatedAt: Number(updated.updatedAt) } });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'CPT_CODE');
    }
};
exports.toggleCPTCodeActive = toggleCPTCodeActive;
