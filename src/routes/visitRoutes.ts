import { Router } from 'express';
import { getVisits, getVisitById, createVisit, updateVisit, deleteVisit } from '../controllers/visitController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getVisits);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getVisitById);
router.post('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), createVisit);
router.put('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), updateVisit);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteVisit);

export default router;
