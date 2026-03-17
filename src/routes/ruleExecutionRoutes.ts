import { Router } from 'express';
import { getRuleExecutions, getRuleExecutionById } from '../controllers/ruleExecutionController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getRuleExecutions);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getRuleExecutionById);

export default router;
