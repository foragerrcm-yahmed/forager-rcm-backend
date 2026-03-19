"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const masterPayorController_1 = require("../controllers/masterPayorController");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticateToken);
// ─── Provider Credentials (must be before /:id to avoid route conflict) ───────
// GET    /api/master-payors/credentials          — list for org
// POST   /api/master-payors/credentials          — create
// DELETE /api/master-payors/credentials/:credId  — delete
router.get('/credentials', masterPayorController_1.listProviderCredentials);
router.post('/credentials', masterPayorController_1.createProviderCredential);
router.delete('/credentials/:credId', masterPayorController_1.deleteProviderCredential);
// ─── Master Payors ────────────────────────────────────────────────────────────
// GET  /api/master-payors            — list (hierarchical by default, ?flat=1, ?search=)
// GET  /api/master-payors/:id        — single payor with children + credentialing info
// POST /api/master-payors/:id/enable — enable for current org
// DELETE /api/master-payors/:id/enable — disable for current org
// PUT  /api/master-payors            — admin upsert (seed/sync)
router.get('/', masterPayorController_1.listMasterPayors);
router.get('/:id', masterPayorController_1.getMasterPayor);
router.post('/:id/enable', masterPayorController_1.enableMasterPayorForOrg);
router.delete('/:id/enable', masterPayorController_1.disableMasterPayorForOrg);
router.put('/', masterPayorController_1.upsertMasterPayor);
exports.default = router;
