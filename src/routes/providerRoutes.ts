import { Router } from 'express';
import { getProviders, getProviderById, createProvider, updateProvider, deleteProvider } from '../controllers/providerController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken); // All provider routes require authentication

// Accessible by Admin and users within their organization
router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getProviders);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getProviderById);
router.post('/', requireRole('Admin', 'Biller', 'FrontDesk'), createProvider);
router.put('/:id', requireRole('Admin', 'Biller', 'FrontDesk'), updateProvider);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteProvider);

export default router;

