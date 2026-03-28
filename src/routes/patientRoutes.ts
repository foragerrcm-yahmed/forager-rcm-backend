import { Router } from 'express';
import multer from 'multer';
import { getPatients, getPatientById, createPatient, updatePatient, deletePatient } from '../controllers/patientController';
import { parseCardForNewPatient } from '../controllers/insuranceCardController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticateToken); // All patient routes require authentication

// Accessible by Admin and users within their organization
router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getPatients);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getPatientById);
router.post('/', requireRole('Admin', 'Biller', 'FrontDesk'), createPatient);
router.put('/:id', requireRole('Admin', 'Biller', 'FrontDesk'), updatePatient);
router.delete('/:id', requireRole('Admin', 'Biller'), deletePatient);

// ── Insurance card OCR for new patient creation ──────────────────────────────
// POST /api/patients/parse-card
//   Accepts a multipart image (field: "card"), runs Tesseract OCR, returns
//   extracted fields including name parts. No policy ID required — used in the
//   Add Patient modal before the patient record exists.
router.post('/parse-card', requireRole('Admin', 'Biller', 'FrontDesk'), upload.single('card'), parseCardForNewPatient);

export default router;

