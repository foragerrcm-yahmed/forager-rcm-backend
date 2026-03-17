import { Router } from 'express';
import { getCPTCodes, getCPTCodeById, createCPTCode, updateCPTCode, deleteCPTCode } from '../controllers/cptCodeController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getCPTCodes);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getCPTCodeById);
router.post('/', requireRole('Admin', 'Biller'), createCPTCode);
router.put('/:id', requireRole('Admin', 'Biller'), updateCPTCode);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteCPTCode);

export default router;
