import { Router } from 'express';
import { getPayors, getPayorById, createPayor, updatePayor, deletePayor } from '../controllers/payorController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken); // All payor routes require authentication

// Accessible by Admin and users within their organization
router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getPayors);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getPayorById);
router.post('/', requireRole('Admin', 'Biller'), createPayor);
router.put('/:id', requireRole('Admin', 'Biller'), updatePayor);
router.delete('/:id', requireRole('Admin', 'Biller'), deletePayor);

export default router;

