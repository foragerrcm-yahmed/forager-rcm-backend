"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const router = (0, express_1.Router)();
// POST /api/admin/seed-master-payors
// Protected by x-admin-seed-secret header — no JWT auth required
router.post('/seed-master-payors', adminController_1.seedMasterPayors);
// POST /api/admin/seed-cms-rates
// Seeds CPTCodeRate records from the 2026 CMS Physician Fee Schedule
router.post('/seed-cms-rates', adminController_1.seedCmsRatesEndpoint);
exports.default = router;
