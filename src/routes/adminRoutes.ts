import { Router } from 'express';
import { seedMasterPayors, seedCmsRatesEndpoint, seedIcd10CodesEndpoint } from '../controllers/adminController';

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

export default router;
