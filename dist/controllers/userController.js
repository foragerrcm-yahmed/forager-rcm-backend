"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUser = exports.updateUser = exports.createUser = exports.getUserById = exports.getUsers = void 0;
const client_1 = require("@prisma/client");
const password_1 = require("../utils/password");
const pagination_1 = require("../utils/pagination");
const errors_1 = require("../utils/errors");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new client_1.PrismaClient();
// Get all users
const getUsers = async (req, res) => {
    try {
        const { page, limit, skip } = (0, pagination_1.getPaginationParams)(req.query.page, req.query.limit);
        const { search, organizationId, role } = req.query;
        const where = {
            organizationId: req.user?.organizationId, // Only users within the authenticated user's organization
        };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (organizationId) {
            where.organizationId = organizationId;
        }
        if (role) {
            where.role = role;
        }
        const [users, total] = await prisma.$transaction([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    role: true,
                    organizationId: true,
                    createdAt: true,
                    updatedAt: true,
                    organization: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            prisma.user.count({ where }),
        ]);
        res.status(200).json({
            success: true,
            data: users.map(user => ({
                ...user,
                createdAt: Number(user.createdAt),
                updatedAt: Number(user.updatedAt),
            })),
            pagination: (0, pagination_1.getPaginationMeta)(page, limit, total),
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'USER');
    }
};
exports.getUsers = getUsers;
// Get user by ID
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id, organizationId: req.user?.organizationId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                organizationId: true,
                createdAt: true,
                updatedAt: true,
                organization: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        if (!user) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.notFound)('USER'), 'User not found');
            return;
        }
        res.status(200).json({
            success: true,
            data: {
                ...user,
                createdAt: Number(user.createdAt),
                updatedAt: Number(user.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'USER');
    }
};
exports.getUserById = getUserById;
// Create a new user
const createUser = async (req, res) => {
    try {
        const { email, password, firstName, lastName, role, organizationId } = req.body;
        // Basic validation
        if (!email || !password || !firstName || !lastName || !role || !organizationId) {
            (0, errors_1.sendError)(res, 400, (0, errors_1.validationError)('USER'), 'All required fields must be provided');
            return;
        }
        // Ensure user is creating within their own organization
        if (req.user?.organizationId !== organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('USER'), 'Cannot create users outside your organization');
            return;
        }
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.duplicate)('USER'), 'User with this email already exists');
            return;
        }
        // Check if organization exists
        const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!organization) {
            (0, errors_1.sendError)(res, 404, (0, errors_1.foreignKeyError)('ORGANIZATION'), 'Organization not found');
            return;
        }
        const passwordHash = await (0, password_1.hashPassword)(password);
        const now = Math.floor(Date.now() / 1000);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                role,
                organization: { connect: { id: organizationId } },
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                organizationId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(201).json({
            success: true,
            data: {
                ...user,
                createdAt: Number(user.createdAt),
                updatedAt: Number(user.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'USER');
    }
};
exports.createUser = createUser;
// Update a user
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { firstName, lastName, role } = req.body;
        const now = Math.floor(Date.now() / 1000);
        // Ensure user is updating within their own organization
        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser || existingUser.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('USER'), 'Cannot update users outside your organization or user not found');
            return;
        }
        const user = await prisma.user.update({
            where: { id },
            data: {
                firstName,
                lastName,
                role,
                updatedAt: BigInt(now),
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                organizationId: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        res.status(200).json({
            success: true,
            data: {
                ...user,
                createdAt: Number(user.createdAt),
                updatedAt: Number(user.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'USER');
    }
};
exports.updateUser = updateUser;
// Delete a user
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        // Ensure user is deleting within their own organization
        const existingUser = await prisma.user.findUnique({ where: { id } });
        if (!existingUser || existingUser.organizationId !== req.user?.organizationId) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('USER'), 'Cannot delete users outside your organization or user not found');
            return;
        }
        // Prevent self-deletion
        if (req.user?.userId === id) {
            (0, errors_1.sendError)(res, 403, (0, errors_1.forbidden)('USER'), 'Cannot delete your own user account');
            return;
        }
        // Check for dependent records (e.g., claimTimelines, attachments)
        const dependentRecords = await prisma.$transaction([
            prisma.claimTimeline.count({ where: { userId: id } }),
            prisma.attachment.count({ where: { uploadedById: id } }),
        ]);
        if (dependentRecords[0] > 0 || dependentRecords[1] > 0) {
            (0, errors_1.sendError)(res, 409, (0, errors_1.deleteFailed)('USER'), 'User has dependent records and cannot be deleted');
            return;
        }
        await prisma.user.delete({ where: { id } });
        res.status(204).send();
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'USER');
    }
};
exports.deleteUser = deleteUser;
