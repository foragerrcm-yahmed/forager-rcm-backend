"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const eligibilityController_1 = require("../controllers/eligibilityController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// Trigger a real-time eligibility check
router.post('/check', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk', 'Provider'), eligibilityController_1.runEligibilityCheck);
// List eligibility checks (filterable by patientId, visitId)
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk', 'Provider'), eligibilityController_1.getEligibilityChecks);
// Get a single eligibility check by ID
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk', 'Provider'), eligibilityController_1.getEligibilityCheckById);
exports.default = router;
