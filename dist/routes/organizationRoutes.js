"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const organizationController_1 = require("../controllers/organizationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken); // All organization routes require authentication
// Admin-only routes for creating, updating, and deleting organizations
router.post('/', (0, auth_1.requireRole)('Admin'), organizationController_1.createOrganization);
router.put('/:id', (0, auth_1.requireRole)('Admin'), organizationController_1.updateOrganization);
router.delete('/:id', (0, auth_1.requireRole)('Admin'), organizationController_1.deleteOrganization);
// Accessible by Admin and users within their organization
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), organizationController_1.getOrganizations);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), organizationController_1.getOrganizationById);
exports.default = router;
