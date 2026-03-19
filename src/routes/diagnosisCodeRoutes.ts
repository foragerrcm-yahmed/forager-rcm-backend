import { Router } from 'express';
import {
  getDiagnosisCodes,
  getDiagnosisCodeById,
  createDiagnosisCode,
  updateDiagnosisCode,
  deleteDiagnosisCode,
  toggleDiagnosisCodeActive,
  getVisitDiagnoses,
  addVisitDiagnosis,
  updateVisitDiagnosis,
  removeVisitDiagnosis,
  toggleCPTCodeActive,
} from '../controllers/diagnosisCodeController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

// ── DiagnosisCode master list (org-scoped ICD-10 library) ──
router.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getDiagnosisCodes);
router.get('/:id', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getDiagnosisCodeById);
router.post('/', requireRole('Admin', 'Biller'), createDiagnosisCode);
router.put('/:id', requireRole('Admin', 'Biller'), updateDiagnosisCode);
router.delete('/:id', requireRole('Admin', 'Biller'), deleteDiagnosisCode);
router.patch('/:id/toggle-active', requireRole('Admin', 'Biller'), toggleDiagnosisCodeActive);

export default router;

// ── Visit diagnoses sub-routes (mounted under /api/visits/:visitId/diagnoses) ──
export const visitDiagnosisRouter = Router({ mergeParams: true });
visitDiagnosisRouter.use(authenticateToken);
visitDiagnosisRouter.get('/', requireRole('Admin', 'Biller', 'Provider', 'FrontDesk'), getVisitDiagnoses);
visitDiagnosisRouter.post('/', requireRole('Admin', 'Biller', 'Provider'), addVisitDiagnosis);
visitDiagnosisRouter.put('/:diagnosisId', requireRole('Admin', 'Biller', 'Provider'), updateVisitDiagnosis);
visitDiagnosisRouter.delete('/:diagnosisId', requireRole('Admin', 'Biller', 'Provider'), removeVisitDiagnosis);

// ── CPT Code active toggle (mounted under /api/cpt-codes/:id/toggle-active) ──
export const cptCodeToggleRouter = Router({ mergeParams: true });
cptCodeToggleRouter.use(authenticateToken);
cptCodeToggleRouter.patch('/', requireRole('Admin', 'Biller'), toggleCPTCodeActive);
