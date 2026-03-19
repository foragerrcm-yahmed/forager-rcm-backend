"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cptCodeController_1 = require("../controllers/cptCodeController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// CPT code CRUD
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), cptCodeController_1.getCPTCodes);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), cptCodeController_1.getCPTCodeById);
router.post('/', (0, auth_1.requireRole)('Admin', 'Biller'), cptCodeController_1.createCPTCode);
router.put('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), cptCodeController_1.updateCPTCode);
router.delete('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), cptCodeController_1.deleteCPTCode);
// Rate tier sub-routes (taxonomy-based pricing)
router.get('/:id/rates', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), cptCodeController_1.getCPTCodeRates);
router.post('/:id/rates', (0, auth_1.requireRole)('Admin', 'Biller'), cptCodeController_1.createCPTCodeRate);
router.put('/:id/rates/:rateId', (0, auth_1.requireRole)('Admin', 'Biller'), cptCodeController_1.updateCPTCodeRate);
router.delete('/:id/rates/:rateId', (0, auth_1.requireRole)('Admin', 'Biller'), cptCodeController_1.deleteCPTCodeRate);
exports.default = router;
