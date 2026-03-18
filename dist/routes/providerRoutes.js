"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const providerController_1 = require("../controllers/providerController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken); // All provider routes require authentication
// Accessible by Admin and users within their organization
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), providerController_1.getProviders);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), providerController_1.getProviderById);
router.post('/', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), providerController_1.createProvider);
router.put('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), providerController_1.updateProvider);
router.delete('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), providerController_1.deleteProvider);
exports.default = router;
