import { Router } from 'express';
import { getClaims, getClaimById, createClaim, updateClaim, updateClaimStatus, deleteClaim, postPatientPayment } from '../controllers/claimController';
import { submitClaimToStedi, checkClaimStatusFromStedi } from '../controllers/claimsStediController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getClaims);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getClaimById);
router.post('/', requireRole('Admin', 'Biller'), createClaim);
router.put('/:id/status', requireRole('Admin', 'Biller'), updateClaimStatus);
router.post('/:id/submit', requireRole('Admin', 'Biller'), submitClaimToStedi);
router.get('/:id/status-check', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), checkClaimStatusFromStedi);
router.put('/:id', requireRole('Admin', 'Biller'), updateClaim);
router.post('/:id/payment', requireRole('Admin', 'Biller', 'FrontDesk'), postPatientPayment);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteClaim);

export default router;
