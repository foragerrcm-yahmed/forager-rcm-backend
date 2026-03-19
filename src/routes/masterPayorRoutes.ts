import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import {
  listMasterPayors,
  getMasterPayor,
  enableMasterPayorForOrg,
  disableMasterPayorForOrg,
  upsertMasterPayor,
  listProviderCredentials,
  createProviderCredential,
  deleteProviderCredential,
} from '../controllers/masterPayorController';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Provider Credentials (must be before /:id to avoid route conflict) ───────
// GET    /api/master-payors/credentials          — list for org
// POST   /api/master-payors/credentials          — create
// DELETE /api/master-payors/credentials/:credId  — delete
router.get('/credentials', listProviderCredentials);
router.post('/credentials', createProviderCredential);
router.delete('/credentials/:credId', deleteProviderCredential);

// ─── Master Payors ────────────────────────────────────────────────────────────
// GET  /api/master-payors            — list (hierarchical by default, ?flat=1, ?search=)
// GET  /api/master-payors/:id        — single payor with children + credentialing info
// POST /api/master-payors/:id/enable — enable for current org
// DELETE /api/master-payors/:id/enable — disable for current org
// PUT  /api/master-payors            — admin upsert (seed/sync)
router.get('/', listMasterPayors);
router.get('/:id', getMasterPayor);
router.post('/:id/enable', enableMasterPayorForOrg);
router.delete('/:id/enable', disableMasterPayorForOrg);
router.put('/', upsertMasterPayor);

export default router;
