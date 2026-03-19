import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';

const prisma = new PrismaClient();

// ─── DiagnosisCode (org-scoped ICD-10 master list) ───────────────────────────

export const getDiagnosisCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, category, showInactive } = req.query;
    const organizationId = (req as any).user?.organizationId;

    const where: any = { organizationId };

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
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS_CODE');
  }
};

export const getDiagnosisCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    const code = await prisma.diagnosisCode.findFirst({
      where: { id, organizationId },
    });
    if (!code) { sendError(res, 404, notFound('DiagnosisCode'), 'Diagnosis code not found'); return; }

    res.status(200).json({ success: true, data: { ...code, createdAt: Number(code.createdAt), updatedAt: Number(code.updatedAt) } });
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS_CODE');
  }
};

export const createDiagnosisCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, description, category } = req.body;
    const organizationId = (req as any).user?.organizationId;

    if (!code || !description) { sendError(res, 400, validationError('DIAGNOSIS_CODE'), 'code and description are required'); return; }

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
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS_CODE');
  }
};

export const updateDiagnosisCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { description, category, isActive } = req.body;
    const organizationId = (req as any).user?.organizationId;

    const existing = await prisma.diagnosisCode.findFirst({ where: { id, organizationId } });
    if (!existing) { sendError(res, 404, notFound('DiagnosisCode'), 'Diagnosis code not found'); return; }

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
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS_CODE');
  }
};

export const deleteDiagnosisCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    const existing = await prisma.diagnosisCode.findFirst({ where: { id, organizationId } });
    if (!existing) { sendError(res, 404, notFound('DiagnosisCode'), 'Diagnosis code not found'); return; }

    await prisma.diagnosisCode.delete({ where: { id } });
    res.status(200).json({ success: true, message: 'Diagnosis code deleted' });
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS_CODE');
  }
};

// Toggle isActive (hide / reinstate)
export const toggleDiagnosisCodeActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const organizationId = (req as any).user?.organizationId;

    const existing = await prisma.diagnosisCode.findFirst({ where: { id, organizationId } });
    if (!existing) { sendError(res, 404, notFound('DiagnosisCode'), 'Diagnosis code not found'); return; }

    const now = BigInt(Math.floor(Date.now() / 1000));
    const updated = await prisma.diagnosisCode.update({
      where: { id },
      data: { isActive: !existing.isActive, updatedAt: now },
    });

    res.status(200).json({ success: true, data: { ...updated, createdAt: Number(updated.createdAt), updatedAt: Number(updated.updatedAt) } });
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS_CODE');
  }
};

// ─── Visit Diagnoses ──────────────────────────────────────────────────────────

export const getVisitDiagnoses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    const diagnoses = await prisma.diagnosis.findMany({
      where: { visitId },
      orderBy: { sequence: 'asc' },
    });
    res.status(200).json({ success: true, data: diagnoses });
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS');
  }
};

export const addVisitDiagnosis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { visitId } = req.params;
    const { icdCode, description, isPrimary, sequence } = req.body;

    if (!icdCode) { sendError(res, 400, validationError('DIAGNOSIS'), 'icdCode is required'); return; }

    // Verify visit exists
    const visit = await prisma.visit.findUnique({ where: { id: visitId } });
    if (!visit) { sendError(res, 404, notFound('Visit'), 'Visit not found'); return; }

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
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS');
  }
};

export const updateVisitDiagnosis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { visitId, diagnosisId } = req.params;
    const { icdCode, description, isPrimary, sequence } = req.body;

    const existing = await prisma.diagnosis.findFirst({ where: { id: diagnosisId, visitId } });
    if (!existing) { sendError(res, 404, notFound('Diagnosis'), 'Diagnosis not found'); return; }

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
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS');
  }
};

export const removeVisitDiagnosis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { visitId, diagnosisId } = req.params;
    const existing = await prisma.diagnosis.findFirst({ where: { id: diagnosisId, visitId } });
    if (!existing) { sendError(res, 404, notFound('Diagnosis'), 'Diagnosis not found'); return; }

    await prisma.diagnosis.delete({ where: { id: diagnosisId } });
    res.status(200).json({ success: true, message: 'Diagnosis removed' });
  } catch (error) {
    handlePrismaError(res, error, 'DIAGNOSIS');
  }
};

// ─── CPT Code isActive toggle ─────────────────────────────────────────────────

export const toggleCPTCodeActive = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await prisma.cPTCode.findUnique({ where: { code: id } });
    if (!existing) { sendError(res, 404, notFound('CPTCode'), 'CPT code not found'); return; }

    const now = BigInt(Math.floor(Date.now() / 1000));
    const updated = await prisma.cPTCode.update({
      where: { code: id },
      data: { isActive: !existing.isActive, updatedAt: now },
    });

    res.status(200).json({ success: true, data: { ...updated, createdAt: Number(updated.createdAt), updatedAt: Number(updated.updatedAt) } });
  } catch (error) {
    handlePrismaError(res, error, 'CPT_CODE');
  }
};
