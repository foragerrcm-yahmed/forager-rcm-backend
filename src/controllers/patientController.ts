import { Request, Response } from 'express';
import { PrismaClient, DataSource, InsuredType } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';
import { handlePrismaError } from '../utils/prismaErrors';

const prisma = new PrismaClient();

// ─── Shared insurance include (always includes dependents) ────────────────────

const INSURANCE_INCLUDE = {
  plan: {
    include: {
      payor: { select: { id: true, name: true, stediPayorId: true } },
    },
  },
  dependents: {
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

// ─── Serialise a policy (BigInt → Number, dependents mapped) ─────────────────

function serializePolicy(policy: any) {
  return {
    ...policy,
    createdAt: Number(policy.createdAt),
    updatedAt: Number(policy.updatedAt),
    subscriberDob: policy.subscriberDob != null ? Number(policy.subscriberDob) : null,
    dependents: (policy.dependents ?? []).map((d: any) => ({
      ...d,
      dateOfBirth: d.dateOfBirth != null ? Number(d.dateOfBirth) : null,
      createdAt: Number(d.createdAt),
      updatedAt: Number(d.updatedAt),
    })),
  };
}

// ─── List patients ────────────────────────────────────────────────────────────

export const getPatients = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, source, includeInsurances } = req.query;

    const where: any = {
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

    if (organizationId) where.organizationId = organizationId;
    if (source) where.source = source as DataSource;

    const include: any = {
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
        insurancePolicies: (patient as any).insurancePolicies?.map(serializePolicy),
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    handlePrismaError(res, error, 'PATIENT');
  }
};

// ─── Get patient by ID ────────────────────────────────────────────────────────

export const getPatientById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { includeInsurances } = req.query;

    const include: any = {
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
      sendError(res, 404, notFound('PATIENT'), 'Patient not found');
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
        insurancePolicies: (patient as any).insurancePolicies?.map(serializePolicy),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'PATIENT');
  }
};

// ─── Create patient ───────────────────────────────────────────────────────────

export const createPatient = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      prefix, firstName, middleName, lastName, suffix,
      dateOfBirth, gender, ssn, phone, email,
      address, city, state, zipCode,
      organizationId, source, insurances,
    } = req.body;

    if (!firstName || !lastName || !dateOfBirth || !organizationId || !source) {
      sendError(res, 400, validationError('PATIENT'), 'Missing required patient fields');
      return;
    }

    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('PATIENT'), 'Cannot create patients outside your organization');
      return;
    }

    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) {
      sendError(res, 404, foreignKeyError('ORGANIZATION'), 'Organization not found');
      return;
    }

    if (insurances && insurances.length > 0) {
      for (const ins of insurances) {
        if (!ins.planId || ins.isPrimary === undefined || !ins.insuredType || !ins.memberId) {
          sendError(res, 400, validationError('PATIENT'), 'Missing required insurance fields');
          return;
        }
        const plan = await prisma.payorPlan.findUnique({ where: { id: ins.planId } });
        if (!plan) {
          sendError(res, 404, foreignKeyError('PAYOR_PLAN'), `Insurance plan with ID ${ins.planId} not found`);
          return;
        }
      }
    }

    const now = BigInt(Math.floor(Date.now() / 1000));

    const patient = await (prisma.patient.create as any)({
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
        createdById: req.user!.userId,
        updatedById: req.user!.userId,
        createdAt: now,
        updatedAt: now,
        insurancePolicies: {
          create: (insurances ?? []).map((ins: any) => ({
            plan: { connect: { id: ins.planId } },
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
                  create: ins.dependents.map((d: any) => ({
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
        insurancePolicies: (patient as any).insurancePolicies?.map(serializePolicy),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'PATIENT');
  }
};

// ─── Update patient ───────────────────────────────────────────────────────────

export const updatePatient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      prefix, firstName, middleName, lastName, suffix,
      dateOfBirth, gender, ssn, phone, email,
      address, city, state, zipCode, source,
    } = req.body;

    const now = BigInt(Math.floor(Date.now() / 1000));

    const existingPatient = await prisma.patient.findUnique({ where: { id } });
    if (!existingPatient || existingPatient.organizationId !== req.user?.organizationId) {
      sendError(res, 403, forbidden('PATIENT'), 'Cannot update patients outside your organization or patient not found');
      return;
    }

    const patient = await (prisma.patient.update as any)({
      where: { id },
      data: {
        ...(prefix     !== undefined ? { prefix }     : {}),
        ...(firstName  !== undefined ? { firstName }  : {}),
        ...(middleName !== undefined ? { middleName } : {}),
        ...(lastName   !== undefined ? { lastName }   : {}),
        ...(suffix     !== undefined ? { suffix }     : {}),
        ...(dateOfBirth ? { dateOfBirth: BigInt(dateOfBirth) } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(ssn    !== undefined ? { ssn }    : {}),
        ...(phone  !== undefined ? { phone }  : {}),
        ...(email  !== undefined ? { email }  : {}),
        ...((address !== undefined || city !== undefined || state !== undefined || zipCode !== undefined) ? {
          address: {
            street: address ?? null,
            city:   city    ?? null,
            state:  state   ?? null,
            zipCode: zipCode ?? null,
          },
        } : {}),
        ...(source !== undefined ? { source } : {}),
        updatedById: req.user!.userId,
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
        insurancePolicies: (patient as any).insurancePolicies?.map(serializePolicy),
      },
    });
  } catch (error) {
    handlePrismaError(res, error, 'PATIENT');
  }
};

// ─── Delete patient ───────────────────────────────────────────────────────────

export const deletePatient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingPatient = await prisma.patient.findUnique({ where: { id } });
    if (!existingPatient || existingPatient.organizationId !== req.user?.organizationId) {
      sendError(res, 403, forbidden('PATIENT'), 'Cannot delete patients outside your organization or patient not found');
      return;
    }

    const [visitCount, claimCount, insuranceCount] = await prisma.$transaction([
      prisma.visit.count({ where: { patientId: id } }),
      prisma.claim.count({ where: { patientId: id } }),
      prisma.patientInsurance.count({ where: { patientId: id } }),
    ]);

    if (visitCount > 0 || claimCount > 0 || insuranceCount > 0) {
      sendError(res, 409, deleteFailed('PATIENT'), 'Patient has dependent records and cannot be deleted');
      return;
    }

    await prisma.patient.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    handlePrismaError(res, error, 'PATIENT');
  }
};
