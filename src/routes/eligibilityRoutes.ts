import { Router } from 'express';
import { runEligibilityCheck, getEligibilityChecks, getEligibilityCheckById } from '../controllers/eligibilityController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

// Trigger a real-time eligibility check
router.post('/check', requireRole('Admin', 'Biller', 'FrontDesk', 'Provider'), runEligibilityCheck);

// List eligibility checks (filterable by patientId, visitId)
router.get('/', requireRole('Admin', 'Biller', 'FrontDesk', 'Provider'), getEligibilityChecks);

// Get a single eligibility check by ID
router.get('/:id', requireRole('Admin', 'Biller', 'FrontDesk', 'Provider'), getEligibilityCheckById);

export default router;
