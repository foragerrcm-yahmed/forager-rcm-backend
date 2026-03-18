"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = exports.login = exports.register = exports.setup = void 0;
const client_1 = require("@prisma/client");
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const prismaErrors_1 = require("../utils/prismaErrors");
const prisma = new client_1.PrismaClient();
// One-time setup: creates the first organization and admin user together
const setup = async (req, res) => {
    try {
        // Disable this endpoint once any user exists
        const userCount = await prisma.user.count();
        if (userCount > 0) {
            res.status(403).json({ error: 'Setup already completed. This endpoint is disabled.' });
            return;
        }
        const { email, password, firstName, lastName, organizationName } = req.body;
        if (!email || !password || !firstName || !lastName || !organizationName) {
            res.status(400).json({ error: 'email, password, firstName, lastName, and organizationName are all required' });
            return;
        }
        const now = Math.floor(Date.now() / 1000);
        // Step 1: Create org without createdById (it's now optional)
        const org = await prisma.organization.create({
            data: {
                name: organizationName,
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
            },
        });
        // Step 2: Create the admin user linked to that org
        const passwordHash = await (0, password_1.hashPassword)(password);
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                role: 'Admin',
                organizationId: org.id,
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
            },
        });
        // Step 3: Update org to point createdById/updatedById to the real user
        await prisma.organization.update({
            where: { id: org.id },
            data: { createdById: user.id, updatedById: user.id },
        });
        const token = (0, jwt_1.generateToken)({
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
        });
        res.status(201).json({
            message: 'Setup complete! Your organization and admin account have been created.',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                organizationId: user.organizationId,
            },
            organization: {
                id: org.id,
                name: organizationName,
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'AUTH');
    }
};
exports.setup = setup;
const register = async (req, res) => {
    try {
        const { email, password, firstName, lastName, role, organizationId } = req.body;
        // Validate required fields
        if (!email || !password || !firstName || !lastName || !role || !organizationId) {
            res.status(400).json({ error: 'All fields are required' });
            return;
        }
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            res.status(409).json({ error: 'User with this email already exists' });
            return;
        }
        // Hash password
        const passwordHash = await (0, password_1.hashPassword)(password);
        // Get current Unix timestamp
        const now = Math.floor(Date.now() / 1000);
        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash,
                firstName,
                lastName,
                role,
                organizationId,
                createdAt: BigInt(now),
                updatedAt: BigInt(now),
            },
        });
        // Generate JWT token
        const token = (0, jwt_1.generateToken)({
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
        });
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                organizationId: user.organizationId,
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'AUTH');
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Validate required fields
        if (!email || !password) {
            res.status(400).json({ error: 'Email and password are required' });
            return;
        }
        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        // Verify password
        const isPasswordValid = await (0, password_1.comparePassword)(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        // Generate JWT token
        const token = (0, jwt_1.generateToken)({
            userId: user.id,
            email: user.email,
            role: user.role,
            organizationId: user.organizationId,
        });
        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                organizationId: user.organizationId,
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'AUTH');
    }
};
exports.login = login;
const getProfile = async (req, res) => {
    try {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
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
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.status(200).json({
            user: {
                ...user,
                createdAt: Number(user.createdAt),
                updatedAt: Number(user.updatedAt),
            },
        });
    }
    catch (error) {
        (0, prismaErrors_1.handlePrismaError)(res, error, 'AUTH');
    }
};
exports.getProfile = getProfile;
