"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const patientController_1 = require("../controllers/patientController");
const insuranceCardController_1 = require("../controllers/insuranceCardController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(auth_1.authenticateToken); // All patient routes require authentication
// Accessible by Admin and users within their organization
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), patientController_1.getPatients);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), patientController_1.getPatientById);
router.post('/', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), patientController_1.createPatient);
router.put('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), patientController_1.updatePatient);
router.delete('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), patientController_1.deletePatient);
// ── Insurance card OCR for new patient creation ──────────────────────────────
// POST /api/patients/parse-card
//   Accepts a multipart image (field: "card"), runs Tesseract OCR, returns
//   extracted fields including name parts. No policy ID required — used in the
//   Add Patient modal before the patient record exists.
router.post('/parse-card', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), upload.single('card'), insuranceCardController_1.parseCardForNewPatient);
exports.default = router;
