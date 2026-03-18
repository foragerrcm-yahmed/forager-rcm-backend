import { Router } from 'express';
import { setup, register, login, getProfile } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// One-time setup route (disabled after first user is created)
router.post('/setup', setup);

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

export default router;
