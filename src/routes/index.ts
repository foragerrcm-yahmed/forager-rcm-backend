import { Router } from 'express';
import { authenticate } from '../middleware/auth';

// Import route handlers
import * as authRoutes from './authRoutes';
import * as userRoutes from './userRoutes';
import * as organizationRoutes from './organizationRoutes';
import * as patientRoutes from './patientRoutes';
import * as providerRoutes from './providerRoutes';
import * as payorRoutes from './payorRoutes';
import * as visitRoutes from './visitRoutes';
import * as claimRoutes from './claimRoutes';
import * as cptCodeRoutes from './cptCodeRoutes';
import * as ruleRoutes from './ruleRoutes';
import * as ruleExecutionRoutes from './ruleExecutionRoutes';
import * as insurancePolicyRoutes from './insurancePolicyRoutes';
import * as attachmentRoutes from './attachmentRoutes';

const router = Router();

// Public routes
router.post('/auth/register', authRoutes.register);
router.post('/auth/login', authRoutes.login);

// Protected routes
router.use(authenticate);

// Auth routes
router.get('/auth/profile', authRoutes.getProfile);

// User routes
router.get('/users', userRoutes.getUsers);
router.get('/users/:id', userRoutes.getUserById);
router.post('/users', userRoutes.createUser);
router.put('/users/:id', userRoutes.updateUser);
router.delete('/users/:id', userRoutes.deleteUser);

// Organization routes
router.get('/organizations', organizationRoutes.getOrganizations);
router.get('/organizations/:id', organizationRoutes.getOrganizationById);
router.post('/organizations', organizationRoutes.createOrganization);
router.put('/organizations/:id', organizationRoutes.updateOrganization);
router.delete('/organizations/:id', organizationRoutes.deleteOrganization);

// Patient routes
router.get('/patients', patientRoutes.getPatients);
router.get('/patients/:id', patientRoutes.getPatientById);
router.post('/patients', patientRoutes.createPatient);
router.put('/patients/:id', patientRoutes.updatePatient);
router.delete('/patients/:id', patientRoutes.deletePatient);

// Provider routes
router.get('/providers', providerRoutes.getProviders);
router.get('/providers/:id', providerRoutes.getProviderById);
router.post('/providers', providerRoutes.createProvider);
router.put('/providers/:id', providerRoutes.updateProvider);
router.delete('/providers/:id', providerRoutes.deleteProvider);

// Payor routes
router.get('/payors', payorRoutes.getPayors);
router.get('/payors/:id', payorRoutes.getPayorById);
router.post('/payors', payorRoutes.createPayor);
router.put('/payors/:id', payorRoutes.updatePayor);
router.delete('/payors/:id', payorRoutes.deletePayor);

// Visit routes
router.get('/visits', visitRoutes.getVisits);
router.get('/visits/:id', visitRoutes.getVisitById);
router.post('/visits', visitRoutes.createVisit);
router.put('/visits/:id', visitRoutes.updateVisit);
router.delete('/visits/:id', visitRoutes.deleteVisit);

// Claim routes
router.get('/claims', claimRoutes.getClaims);
router.get('/claims/:id', claimRoutes.getClaimById);
router.post('/claims', claimRoutes.createClaim);
router.put('/claims/:id', claimRoutes.updateClaim);
router.put('/claims/:id/status', claimRoutes.updateClaimStatus);
router.delete('/claims/:id', claimRoutes.deleteClaim);

// CPT Code routes
router.get('/cpt-codes', cptCodeRoutes.getCPTCodes);
router.get('/cpt-codes/:id', cptCodeRoutes.getCPTCodeById);
router.post('/cpt-codes', cptCodeRoutes.createCPTCode);
router.put('/cpt-codes/:id', cptCodeRoutes.updateCPTCode);
router.delete('/cpt-codes/:id', cptCodeRoutes.deleteCPTCode);

// Rule routes
router.get('/rules', ruleRoutes.getRules);
router.get('/rules/:id', ruleRoutes.getRuleById);
router.post('/rules', ruleRoutes.createRule);
router.put('/rules/:id', ruleRoutes.updateRule);
router.put('/rules/:id/toggle', ruleRoutes.toggleRuleStatus);
router.delete('/rules/:id', ruleRoutes.deleteRule);

// Rule Execution routes
router.get('/rule-executions', ruleExecutionRoutes.getRuleExecutions);
router.get('/rule-executions/:id', ruleExecutionRoutes.getRuleExecutionById);

// Insurance Policy routes
router.get('/insurance-policies', insurancePolicyRoutes.getInsurancePolicies);
router.get('/insurance-policies/:id', insurancePolicyRoutes.getInsurancePolicyById);
router.put('/insurance-policies/:id', insurancePolicyRoutes.updateInsurancePolicy);
router.delete('/insurance-policies/:id', insurancePolicyRoutes.deleteInsurancePolicy);

// Attachment routes
router.get('/attachments', attachmentRoutes.getAttachments);
router.post('/attachments', attachmentRoutes.uploadAttachment);
router.get('/attachments/:id/download', attachmentRoutes.downloadAttachment);
router.delete('/attachments/:id', attachmentRoutes.deleteAttachment);

export default router;
