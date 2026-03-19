import { Router } from 'express';
import {
  seedMasterPayors,
  seedCmsRatesEndpoint,
  seedIcd10CodesEndpoint,
  seedTestDataEndpoint,
} from '../controllers/adminController';

const router = Router();

// POST /api/admin/seed-master-payors
// Protected by x-admin-seed-secret header — no JWT auth required
router.post('/seed-master-payors', seedMasterPayors);

// POST /api/admin/seed-cms-rates
// Seeds CPTCodeRate records from the 2026 CMS Physician Fee Schedule
router.post('/seed-cms-rates', seedCmsRatesEndpoint);

// POST /api/admin/seed-icd10-codes
// Seeds common ICD-10-CM diagnosis codes for all orgs (or a specific org)
router.post('/seed-icd10-codes', seedIcd10CodesEndpoint);

// POST /api/admin/seed-test-data
// Creates Aetna payor, plan, test patient (Jane Doe), provider (Dr. Alex Test), and visit
// Uses Stedi sandbox member ID W000000000 which always returns a valid 271
router.post('/seed-test-data', seedTestDataEndpoint);

export default router;
