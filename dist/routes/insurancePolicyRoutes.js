"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const insurancePolicyController_1 = require("../controllers/insurancePolicyController");
const insuranceCardController_1 = require("../controllers/insuranceCardController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(auth_1.authenticateToken);
router.get('/', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), insurancePolicyController_1.getInsurancePolicies);
router.get('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'Provider', 'FrontDesk'), insurancePolicyController_1.getInsurancePolicyById);
router.post('/', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), insurancePolicyController_1.createInsurancePolicy);
router.put('/:id', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), insurancePolicyController_1.updateInsurancePolicy);
router.delete('/:id', (0, auth_1.requireRole)('Admin', 'Biller'), insurancePolicyController_1.deleteInsurancePolicy);
// ── Insurance card photo routes ──────────────────────────────────────────────
// POST   /:id/card        — upload/replace the card image
// DELETE /:id/card        — remove the card image
// POST   /:id/parse-card  — upload image, run AI extraction, return fields
router.post('/:id/card', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), upload.single('card'), insuranceCardController_1.uploadInsuranceCard);
router.delete('/:id/card', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), insuranceCardController_1.deleteInsuranceCard);
router.post('/:id/parse-card', (0, auth_1.requireRole)('Admin', 'Biller', 'FrontDesk'), upload.single('card'), insuranceCardController_1.parseInsuranceCard);
exports.default = router;
