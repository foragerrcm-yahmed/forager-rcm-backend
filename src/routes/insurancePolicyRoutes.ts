import { Router } from 'express';
import multer from 'multer';
import { getInsurancePolicies, getInsurancePolicyById, createInsurancePolicy, updateInsurancePolicy, deleteInsurancePolicy } from '../controllers/insurancePolicyController';
import { uploadInsuranceCard, deleteInsuranceCard, parseInsuranceCard } from '../controllers/insuranceCardController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getInsurancePolicies);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getInsurancePolicyById);
router.post('/', requireRole('Admin', 'Biller', 'FrontDesk'), createInsurancePolicy);
router.put('/:id', requireRole('Admin', 'Biller', 'FrontDesk'), updateInsurancePolicy);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteInsurancePolicy);

// ── Insurance card photo routes ──────────────────────────────────────────────
// POST   /:id/card        — upload/replace the card image
// DELETE /:id/card        — remove the card image
// POST   /:id/parse-card  — upload image, run AI extraction, return fields
router.post('/:id/card', requireRole('Admin', 'Biller', 'FrontDesk'), upload.single('card'), uploadInsuranceCard);
router.delete('/:id/card', requireRole('Admin', 'Biller', 'FrontDesk'), deleteInsuranceCard);
router.post('/:id/parse-card', requireRole('Admin', 'Biller', 'FrontDesk'), upload.single('card'), parseInsuranceCard);

export default router;
