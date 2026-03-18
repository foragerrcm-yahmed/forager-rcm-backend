"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const patientController_1 = require("../controllers/patientController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken); // All patient routes require authentication
// Accessible by Admin and users within their organization
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), patientController_1.getPatients);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), patientController_1.getPatientById);
router.post('/', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), patientController_1.createPatient);
router.put('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), patientController_1.updatePatient);
router.delete('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), patientController_1.deletePatient);
exports.default = router;
