import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listMasterPayors,
  getMasterPayor,
  enableMasterPayorForOrg,
  disableMasterPayorForOrg,
  upsertMasterPayor,
} from '../controllers/masterPayorController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// List / search all active master payors (includes enabledForOrg flag)
router.get('/', listMasterPayors);

// Get a single master payor by ID
router.get('/:id', getMasterPayor);

// Enable a master payor for the current org (creates a Payor record)
router.post('/:id/enable', enableMasterPayorForOrg);

// Disable a master payor for the current org (deletes the Payor record)
router.delete('/:id/enable', disableMasterPayorForOrg);

// Admin: upsert a master payor (used by seed/sync)
router.put('/', upsertMasterPayor);

export default router;
