"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payorController_1 = require("../controllers/payorController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken); // All payor routes require authentication
// Accessible by Admin and users within their organization
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), payorController_1.getPayors);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), payorController_1.getPayorById);
router.post('/', (0, auth_1.requireRole)('Admin', 'Biller'), payorController_1.createPayor);
router.put('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), payorController_1.updatePayor);
router.delete('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), payorController_1.deletePayor);
exports.default = router;
