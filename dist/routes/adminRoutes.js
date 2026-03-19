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
// POST /api/admin/seed-icd10-codes
// Seeds common ICD-10-CM diagnosis codes for all orgs (or a specific org)
router.post('/seed-icd10-codes', adminController_1.seedIcd10CodesEndpoint);
// POST /api/admin/seed-test-data
// Creates Aetna payor, plan, test patient (Jane Doe), provider (Dr. Alex Test), and visit
// Uses Stedi sandbox member ID W000000000 which always returns a valid 271
router.post('/seed-test-data', adminController_1.seedTestDataEndpoint);
exports.default = router;
