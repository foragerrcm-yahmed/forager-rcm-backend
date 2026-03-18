"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken); // All user routes require authentication
// Admin-only routes
router.post('/', (0, auth_1.requireRole)('Admin'), userController_1.createUser);
router.put('/:id', (0, auth_1.requireRole)('Admin'), userController_1.updateUser);
router.delete('/:id', (0, auth_1.requireRole)('Admin'), userController_1.deleteUser);
// Accessible by Admin and users within their organization
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), userController_1.getUsers);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), userController_1.getUserById);
exports.default = router;
