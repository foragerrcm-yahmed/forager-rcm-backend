import { Router } from 'express';
import { getOrganizations, getOrganizationById, createOrganization, updateOrganization, deleteOrganization } from '../controllers/organizationController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken); // All organization routes require authentication

// Admin-only routes for creating, updating, and deleting organizations
router.post('/', requireRole('Admin'), createOrganization);
router.put('/:id', requireRole('Admin'), updateOrganization);
router.delete('/:id', requireRole('Admin'), deleteOrganization);

// Accessible by Admin and users within their organization
router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getOrganizations);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getOrganizationById);

export default router;

