import { Router } from 'express';
import {
  getCPTCodes, getCPTCodeById, createCPTCode, updateCPTCode, deleteCPTCode,
  getCPTCodeRates, createCPTCodeRate, updateCPTCodeRate, deleteCPTCodeRate,
} from '../controllers/cptCodeController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// CPT code CRUD
router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getCPTCodes);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getCPTCodeById);
router.post('/', requireRole('Admin', 'Biller'), createCPTCode);
router.put('/:id', requireRole('Admin', 'Biller'), updateCPTCode);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteCPTCode);

// Rate tier sub-routes (taxonomy-based pricing)
router.get('/:id/rates', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getCPTCodeRates);
router.post('/:id/rates', requireRole('Admin', 'Biller'), createCPTCodeRate);
router.put('/:id/rates/:rateId', requireRole('Admin', 'Biller'), updateCPTCodeRate);
router.delete('/:id/rates/:rateId', requireRole('Admin', 'Biller'), deleteCPTCodeRate);

export default router;
