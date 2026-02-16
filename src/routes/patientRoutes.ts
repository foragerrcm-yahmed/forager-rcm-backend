import { Router } from 'express';
import { getPatients, getPatientById, createPatient, updatePatient, deletePatient } from '../controllers/patientController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken); // All patient routes require authentication

// Accessible by Admin and users within their organization
router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getPatients);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getPatientById);
router.post('/', requireRole('Admin', 'Biller', 'FrontDesk'), createPatient);
router.put('/:id', requireRole('Admin', 'Biller', 'FrontDesk'), updatePatient);
router.delete('/:id', requireRole('Admin', 'Biller'), deletePatient);

export default router;

