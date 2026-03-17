import { Router } from 'express';
import { getRules, getRuleById, createRule, updateRule, toggleRuleStatus, deleteRule } from '../controllers/ruleController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getRules);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getRuleById);
router.post('/', requireRole('Admin', 'Biller'), createRule);
router.put('/:id/toggle', requireRole('Admin', 'Biller'), toggleRuleStatus);
router.put('/:id', requireRole('Admin', 'Biller'), updateRule);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteRule);

export default router;
