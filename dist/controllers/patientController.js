"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePatient = exports.updatePatient = exports.createPatient = exports.getPatientById = exports.getPatients = void 0;
const client_1 = require("@prisma/client");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new client_1.PrismaClient();
// Get all patients
const getPatients = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, source, includeInsurances } = req.query;
        const where = {
            organizationId: req.user?.organizationId, // Only patients within the authenticated user's organization
        };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (organizationId) {
            where.organizationId = organizationId;
        }
        if (source) {
            where.source = source;
        }
        const include = {
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
                include: include,
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
                insurancePolicies: patient.insurancePolicies?.map((policy) => ({
                    ...policy,
                    createdAt: Number(policy.createdAt),
                    updatedAt: Number(policy.updatedAt),
                    subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
                }))
            })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.getPatients = getPatients;
// Get patient by ID
const getPatientById = async (req, res) => {
    try {
        const { id } = req.params;
        const { includeInsurances } = req.query;
        const include = {
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
            where: { id, organizationId: req.user?.organizationId },
            include: include,
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
                insurancePolicies: patient.insurancePolicies?.map((policy) => ({
                    ...policy,
                    createdAt: Number(policy.createdAt),
                    updatedAt: Number(policy.updatedAt),
                    subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
                }))
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.getPatientById = getPatientById;
// Create a new patient
const createPatient = async (req, res) => {
    try {
        const { prefix, firstName, middleName, lastName, suffix, dateOfBirth, gender, ssn, phone, email, address, city, state, zipCode, organizationId, source, insurances } = req.body;
        // Basic validation
        if (!firstName || !lastName || !dateOfBirth || !organizationId || !source) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PATIENT'), 'Missing required patient fields');
            return;
        }
        // Ensure user is creating within their own organization
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PATIENT'), 'Cannot create patients outside your organization');
            return;
        }
        // Check if organization exists
        const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!organization) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('ORGANIZATION'), 'Organization not found');
            return;
        }
        // Validate insurances if provided
        if (insurances && insurances.length > 0) {
            for (const ins of insurances) {
                if (!ins.planId || !ins.isPrimary || !ins.insuredType || !ins.memberId) {
                    (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PATIENT'), 'Missing required insurance fields');
                    return;
                }
                if (ins.insuredType === client_1.InsuredType.Dependent && (!ins.subscriberName || !ins.subscriberDob)) {
                    (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PATIENT'), 'Dependent insurance requires subscriberName and subscriberDob');
                    return;
                }
                const plan = await prisma.payorPlan.findUnique({ where: { id: ins.planId } });
                if (!plan) {
                    (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('PAYOR_PLAN'), `Insurance plan with ID ${ins.planId} not found`);
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
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
                insurancePolicies: {
                    create: insurances?.map((ins) => ({
                        plan: { connect: { id: ins.planId } },
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
                insurancePolicies: patient.insurancePolicies?.map((policy) => ({
                    ...policy,
                    createdAt: Number(policy.createdAt),
                    updatedAt: Number(policy.updatedAt),
                    subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
                }))
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.createPatient = createPatient;
// Update a patient
const updatePatient = async (req, res) => {
    try {
        const { id } = req.params;
        const { prefix, firstName, middleName, lastName, suffix, dateOfBirth, gender, ssn, phone, email, address, city, state, zipCode, source, insurances } = req.body;
        const now = Math.floor(Date.now() / 1000);
        // Ensure user is updating a patient within their own organization
        const existingPatient = await prisma.patient.findUnique({ where: { id } });
        if (!existingPatient || existingPatient.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PATIENT'), 'Cannot update patients outside your organization or patient not found');
            return;
        }
        // Handle insurances update (this is a simplified approach, a more robust solution would involve diffing and separate endpoints)
        if (insurances) {
            // Delete existing insurances for this patient
            await prisma.patientInsurance.deleteMany({ where: { patientId: id } });
            // Create new insurances
            for (const ins of insurances) {
                if (!ins.planId || !ins.isPrimary || !ins.insuredType || !ins.memberId) {
                    (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PATIENT'), 'Missing required insurance fields');
                    return;
                }
                if (ins.insuredType === client_1.InsuredType.Dependent && (!ins.subscriberName || !ins.subscriberDob)) {
                    (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('PATIENT'), 'Dependent insurance requires subscriberName and subscriberDob');
                    return;
                }
                const plan = await prisma.payorPlan.findUnique({ where: { id: ins.planId } });
                if (!plan) {
                    (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('PAYOR_PLAN'), `Insurance plan with ID ${ins.planId} not found`);
                    return;
                }
                await prisma.patientInsurance.create({
                    data: {
                        patient: { connect: { id } },
                        plan: { connect: { id: ins.planId } },
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
            where: { id },
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
                address: (address !== undefined || city !== undefined || state !== undefined || zipCode !== undefined) ? {
                    street: address || null,
                    city: city || null,
                    state: state || null,
                    zipCode: zipCode || null,
                } : undefined,
                source,
                updatedById: req.user.userId,
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
                insurancePolicies: patient.insurancePolicies?.map((policy) => ({
                    ...policy,
                    createdAt: Number(policy.createdAt),
                    updatedAt: Number(policy.updatedAt),
                    subscriberDob: policy.subscriberDob ? Number(policy.subscriberDob) : null,
                }))
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'PATIENT');
    }
};
exports.updatePatient = updatePatient;
// Delete a patient
const deletePatient = async (req, res) => {
    try {
        const { id } = req.params;
        // Ensure user is deleting a patient within their own organization
        const existingPatient = await prisma.patient.findUnique({ where: { id } });
        if (!existingPatient || existingPatient.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('PATIENT'), 'Cannot delete patients outside your organization or patient not found');
            return;
        }
        // Check for dependent records
        const dependentRecords = await prisma.$transaction([
            prisma.visit.count({ where: { patientId: id } }),
            prisma.claim.count({ where: { patientId: id } }),
            prisma.patientInsurance.count({ where: { patientId: id } }),
        ]);
        const hasDependents = dependentRecords.some(count => count > 0);
        if (hasDependents) {
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
