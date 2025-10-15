import { Request, Response } from 'express';
import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../utils/password';
import { getPaginationParams, getPaginationMeta } from '../utils/pagination';
import { sendError, notFound, validationError, duplicate, forbidden, deleteFailed } from '../utils/errors';

const prisma = new PrismaClient();

// Get all users
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page as string, req.query.limit as string);
    const { search, organizationId, role } = req.query;

    const where: any = {
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
      where.role = role as UserRole;
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
      pagination: getPaginationMeta(page, limit, total),
    });
  } catch (error) {
    console.error('Get users error:', error);
    sendError(res, 500, 'USER_INTERNAL_ERROR', 'Internal server error');
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response): Promise<void> => {
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
      sendError(res, 404, notFound('USER'), 'User not found');
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
  } catch (error) {
    console.error('Get user by ID error:', error);
    sendError(res, 500, 'USER_INTERNAL_ERROR', 'Internal server error');
  }
};

// Create a new user
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, role, organizationId } = req.body;

    // Basic validation
    if (!email || !password || !firstName || !lastName || !role || !organizationId) {
      sendError(res, 400, validationError('USER'), 'All required fields must be provided');
      return;
    }

    // Ensure user is creating within their own organization
    if (req.user?.organizationId !== organizationId) {
      sendError(res, 403, forbidden('USER'), 'Cannot create users outside your organization');
      return;
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      sendError(res, 409, duplicate('USER'), 'User with this email already exists');
      return;
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) {
      sendError(res, 404, foreignKeyError('ORGANIZATION'), 'Organization not found');
      return;
    }

    const passwordHash = await hashPassword(password);
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
  } catch (error) {
    console.error('Create user error:', error);
    sendError(res, 500, 'USER_INTERNAL_ERROR', 'Internal server error');
  }
};

// Update a user
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role } = req.body;
    const now = Math.floor(Date.now() / 1000);

    // Ensure user is updating within their own organization
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser || existingUser.organizationId !== req.user?.organizationId) {
      sendError(res, 403, forbidden('USER'), 'Cannot update users outside your organization or user not found');
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
  } catch (error) {
    console.error('Update user error:', error);
    sendError(res, 500, 'USER_INTERNAL_ERROR', 'Internal server error');
  }
};

// Delete a user
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Ensure user is deleting within their own organization
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser || existingUser.organizationId !== req.user?.organizationId) {
      sendError(res, 403, forbidden('USER'), 'Cannot delete users outside your organization or user not found');
      return;
    }

    // Prevent self-deletion
    if (req.user?.userId === id) {
      sendError(res, 403, forbidden('USER'), 'Cannot delete your own user account');
      return;
    }

    // Check for dependent records (e.g., claimTimelines, attachments)
    const dependentRecords = await prisma.$transaction([
      prisma.claimTimeline.count({ where: { userId: id } }),
      prisma.attachment.count({ where: { uploadedById: id } }),
    ]);

    if (dependentRecords[0] > 0 || dependentRecords[1] > 0) {
      sendError(res, 409, deleteFailed('USER'), 'User has dependent records and cannot be deleted');
      return;
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Delete user error:', error);
    sendError(res, 500, 'USER_INTERNAL_ERROR', 'Internal server error');
  }
};

