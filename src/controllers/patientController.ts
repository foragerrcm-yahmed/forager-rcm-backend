import { Request, Response } from 'express';
import { PrismaClient, DataSource, InsuredType } from '@prisma/client';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed, foreignKeyError } from '../utils/errors';

const prisma = new PrismaClient();

// Get all patients
export const getPatients = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, source, includeInsurances } = req.query;

    const where: any = {
      organizationId: req.user?.organizationId, // Only patients within the authenticated user's organization
    };

    if (search && typeof search === 'string') {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (organizationId && typeof organizationId === 'string') {
      where.organizationId = organizationId;
    }

    if (source && typeof source === 'string') {
      where.source = source as DataSource;
    }

    const include: any = {
      createdBy: {
        select: { id: true, firstName: true, lastName: true }
      },
      updatedBy: {
        select: { id: true, firstName: true, lastName: true }
      },
    };

    if (includeInsurances === 'true') {
      include.insurancePolicies = {
        include: {
          plan: {
            include: {
              payor: {
                select: { name: true }
              }
            }
          }
        }
      };
    }

    const [patients, total] = await prisma.$transaction([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        include,
      }),
      prisma.patient.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: patients.map(patient => ({
        ...patient,
        createdAt: Number(patient.createdAt),
        updatedAt: Number(patient.updatedAt),
        dateOfBirth: Number(patient.dateOfBirth),
        // Mask SSN for security
        ssn: patient.ssn ? '***-**-' + patient.ssn.slice(-4) : null,
        insurancePolicies: (patient as any).insurancePolicies?.map((policy: any) => ({
          ...policy,
          createdAt: Number(policy.createdAt),
          updatedAt: Number(policy.updatedAt),
          subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
        }))
      })),
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get patients error:', error);
    sendError(res, 500, 'PATIENT_INTERNAL_ERROR', 'Internal server error');
  }
};

// Get patient by ID
export const getPatientById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { includeInsurances } = req.query;

    const include: any = {
      createdBy: {
        select: { id: true, firstName: true, lastName: true }
      },
      updatedBy: {
        select: { id: true, firstName: true, lastName: true }
      },
    };

    if (includeInsurances === 'true') {
      include.insurancePolicies = {
        include: {
          plan: {
            include: {
              payor: {
                select: { name: true }
              }
            }
          }
        }
      };
    }

    const patient = await prisma.patient.findUnique({
      where: { id: id as string, organizationId: req.user?.organizationId as string | undefined },
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
        insurancePolicies: (patient as any).insurancePolicies?.map((policy: any) => ({
          ...policy,
          createdAt: Number(policy.createdAt),
          updatedAt: Number(policy.updatedAt),
          subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
        }))
      },
    });
  } catch (error) {
    console.error('Get patient by ID error:', error);
    sendError(res, 500, 'PATIENT_INTERNAL_ERROR', 'Internal server error');
  }
};

// Create a new patient
export const createPatient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prefix, firstName, middleName, lastName, suffix, dateOfBirth, gender, ssn, phone, email, address, organizationId, source, insurances } = req.body;

    // Basic validation
    if (!firstName || !lastName || !dateOfBirth || !organizationId || !source) {
      sendError(res, 400, validationError('PATIENT'), 'Missing required patient fields');
      return;
    }

    // Ensure user is creating within their own organization
    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('PATIENT'), 'Cannot create patients outside your organization');
      return;
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({ where: { id: organizationId as string } });
    if (!organization) {
      sendError(res, 404, foreignKeyError('ORGANIZATION'), 'Organization not found');
      return;
    }

    // Validate insurances if provided
    if (insurances && insurances.length > 0) {
      for (const ins of insurances) {
        if (!ins.planId || !ins.isPrimary || !ins.insuredType || !ins.memberId) {
          sendError(res, 400, validationError('PATIENT'), 'Missing required insurance fields');
          return;
        }
        if (ins.insuredType === InsuredType.Dependent && (!ins.subscriberName || !ins.subscriberDob)) {
          sendError(res, 400, validationError('PATIENT'), 'Dependent insurance requires subscriberName and subscriberDob');
          return;
        }
        const plan = await prisma.payorPlan.findUnique({ where: { id: ins.planId as string } });
        if (!plan) {
          sendError(res, 404, foreignKeyError('PAYOR_PLAN'), `Insurance plan with ID ${ins.planId} not found`);
          return;
        }
      }
    }

    const now = Math.floor(Date.now() / 1000);

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
        address,
        organization: { connect: { id: organizationId as string } },
        source,
        createdBy: { connect: { id: req.user!.userId } },
        updatedBy: { connect: { id: req.user!.userId } },
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
        insurancePolicies: {
          create: insurances?.map((ins: any) => ({
            plan: { connect: { id: ins.planId as string } },
            isPrimary: ins.isPrimary,
            insuredType: ins.insuredType,
            subscriberName: ins.subscriberName,
            subscriberDob: ins.subscriberDob ? BigInt(ins.subscriberDob) : null,
            memberId: ins.memberId,
            insuranceCardPath: ins.insuranceCard, // Assuming this is a path after upload
            createdAt: BigInt(now),
            updatedAt: BigInt(now),
          })) || [],
        },
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        insurancePolicies: {
          include: {
            plan: {
              include: {
                payor: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: {
        ...patient,
        createdAt: Number(patient.createdAt),
        updatedAt: Number(patient.updatedAt),
        dateOfBirth: Number(patient.dateOfBirth),
        ssn: patient.ssn ? '***-**-' + patient.ssn.slice(-4) : null,
        insurancePolicies: (patient as any).insurancePolicies?.map((policy: any) => ({
          ...policy,
          createdAt: Number(policy.createdAt),
          updatedAt: Number(policy.updatedAt),
          subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
        }))
      },
    });
  } catch (error) {
    console.error('Create patient error:', error);
    sendError(res, 500, 'PATIENT_INTERNAL_ERROR', 'Internal server error');
  }
};

// Update a patient
export const updatePatient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { prefix, firstName, middleName, lastName, suffix, dateOfBirth, gender, ssn, phone, email, address, source, insurances } = req.body;
    const now = Math.floor(Date.now() / 1000);

    // Ensure user is updating a patient within their own organization
    const existingPatient = await prisma.patient.findUnique({ where: { id: id as string } });
    if (!existingPatient || existingPatient.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('PATIENT'), 'Cannot update patients outside your organization or patient not found');
      return;
    }

    // Handle insurances update (this is a simplified approach, a more robust solution would involve diffing and separate endpoints)
    if (insurances) {
      // Delete existing insurances for this patient
      await prisma.patientInsurance.deleteMany({ where: { patientId: id as string } });
      // Create new insurances
      for (const ins of insurances) {
        if (!ins.planId || !ins.isPrimary || !ins.insuredType || !ins.memberId) {
          sendError(res, 400, validationError('PATIENT'), 'Missing required insurance fields');
          return;
        }
        if (ins.insuredType === InsuredType.Dependent && (!ins.subscriberName || !ins.subscriberDob)) {
          sendError(res, 400, validationError('PATIENT'), 'Dependent insurance requires subscriberName and subscriberDob');
          return;
        }
        const plan = await prisma.payorPlan.findUnique({ where: { id: ins.planId as string } });
        if (!plan) {
          sendError(res, 404, foreignKeyError('PAYOR_PLAN'), `Insurance plan with ID ${ins.planId} not found`);
          return;
        }
        await prisma.patientInsurance.create({
          data: {
            patient: { connect: { id: id as string } },
            plan: { connect: { id: ins.planId as string } },
            isPrimary: ins.isPrimary,
            insuredType: ins.insuredType,
            subscriberName: ins.subscriberName,
            subscriberDob: ins.subscriberDob ? BigInt(ins.subscriberDob) : null,
            memberId: ins.memberId,
            insuranceCardPath: ins.insuranceCard,
            createdAt: BigInt(now),
            updatedAt: BigInt(now),
          }
        });
      }
    }

    const patient = await prisma.patient.update({
      where: { id: id as string },
      data: {
        prefix,
        firstName,
        middleName,
        lastName,
        suffix,
        dateOfBirth: dateOfBirth ? BigInt(dateOfBirth) : undefined,
        gender,
        ssn,
        phone,
        email,
        address,
        source,
        updatedBy: { connect: { id: req.user!.userId } },
        updatedAt: BigInt(now),
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        updatedBy: { select: { id: true, firstName: true, lastName: true } },
        insurancePolicies: {
          include: {
            plan: {
              include: {
                payor: { select: { name: true } }
              }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        ...patient,
        createdAt: Number(patient.createdAt),
        updatedAt: Number(patient.updatedAt),
        dateOfBirth: Number(patient.dateOfBirth),
        ssn: patient.ssn ? '***-**-' + patient.ssn.slice(-4) : null,
        insurancePolicies: (patient as any).insurancePolicies?.map((policy: any) => ({
          ...policy,
          createdAt: Number(policy.createdAt),
          updatedAt: Number(policy.updatedAt),
          subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
        }))
      },
    });
  } catch (error) {
    console.error('Update patient error:', error);
    sendError(res, 500, 'PATIENT_INTERNAL_ERROR', 'Internal server error');
  }
};

// Delete a patient
export const deletePatient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Ensure user is deleting a patient within their own organization
    const existingPatient = await prisma.patient.findUnique({ where: { id: id as string } });
    if (!existingPatient || existingPatient.organizationId !== (req.user?.organizationId as string | undefined)) {
      sendError(res, 403, forbidden('PATIENT'), 'Cannot delete patients outside your organization or patient not found');
      return;
    }

    // Check for dependent records
    const dependentRecords = await prisma.$transaction([
      prisma.visit.count({ where: { patientId: id as string } }),
      prisma.claim.count({ where: { patientId: id as string } }),
      prisma.patientInsurance.count({ where: { patientId: id as string } }),
    ]);

    const hasDependents = dependentRecords.some(count => count > 0);

    if (hasDependents) {
      sendError(res, 409, deleteFailed('PATIENT'), 'Patient has dependent records and cannot be deleted');
      return;
    }

    await prisma.patient.delete({ where: { id: id as string } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete patient error:', error);
    sendError(res, 500, 'PATIENT_INTERNAL_ERROR', 'Internal server error');
  }
};
