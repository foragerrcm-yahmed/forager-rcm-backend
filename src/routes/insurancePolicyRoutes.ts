import { Router } from 'express';
import { getInsurancePolicies, getInsurancePolicyById, updateInsurancePolicy, deleteInsurancePolicy } from '../controllers/insurancePolicyController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getInsurancePolicies);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getInsurancePolicyById);
router.put('/:id', requireRole('Admin', 'Biller', 'FrontDesk'), updateInsurancePolicy);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteInsurancePolicy);

export default router;
