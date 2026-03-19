import { Router } from 'express';
import { seedMasterPayors } from '../controllers/adminController';

const router = Router();

// POST /api/admin/seed-master-payors
// Protected by x-admin-seed-secret header — no JWT auth required
router.post('/seed-master-payors', seedMasterPayors);

export default router;
