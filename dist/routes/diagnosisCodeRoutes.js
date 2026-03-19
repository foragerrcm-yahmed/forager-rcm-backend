"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cptCodeToggleRouter = exports.visitDiagnosisRouter = void 0;
const express_1 = require("express");
const diagnosisCodeController_1 = require("../controllers/diagnosisCodeController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
// ── DiagnosisCode master list (org-scoped ICD-10 library) ──
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), diagnosisCodeController_1.getDiagnosisCodes);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), diagnosisCodeController_1.getDiagnosisCodeById);
router.post('/', (0, auth_1.requireRole)('Admin', 'Biller'), diagnosisCodeController_1.createDiagnosisCode);
router.put('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), diagnosisCodeController_1.updateDiagnosisCode);
router.delete('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), diagnosisCodeController_1.deleteDiagnosisCode);
router.patch('/:id/toggle-active', (0, auth_1.requireRole)('Admin', 'Biller'), diagnosisCodeController_1.toggleDiagnosisCodeActive);
exports.default = router;
// ── Visit diagnoses sub-routes (mounted under /api/visits/:visitId/diagnoses) ──
exports.visitDiagnosisRouter = (0, express_1.Router)({ mergeParams: true });
exports.visitDiagnosisRouter.use(auth_1.authenticateToken);
exports.visitDiagnosisRouter.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), diagnosisCodeController_1.getVisitDiagnoses);
exports.visitDiagnosisRouter.post('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider'), diagnosisCodeController_1.addVisitDiagnosis);
exports.visitDiagnosisRouter.put('/:diagnosisId', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider'), diagnosisCodeController_1.updateVisitDiagnosis);
exports.visitDiagnosisRouter.delete('/:diagnosisId', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider'), diagnosisCodeController_1.removeVisitDiagnosis);
// ── CPT Code active toggle (mounted under /api/cpt-codes/:id/toggle-active) ──
exports.cptCodeToggleRouter = (0, express_1.Router)({ mergeParams: true });
exports.cptCodeToggleRouter.use(auth_1.authenticateToken);
exports.cptCodeToggleRouter.patch('/', (0, auth_1.requireRole)('Admin', 'Biller'), diagnosisCodeController_1.toggleCPTCodeActive);
