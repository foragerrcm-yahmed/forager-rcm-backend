import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/userController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticateToken); // All user routes require authentication

// Admin-only routes
router.post('/', requireRole('Admin'), createUser);
router.put('/:id', requireRole('Admin'), updateUser);
router.delete('/:id', requireRole('Admin'), deleteUser);

// Accessible by Admin and users within their organization
router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getUsers);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getUserById);

export default router;

