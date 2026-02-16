import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import organizationRoutes from './routes/organizationRoutes';
import patientRoutes from './routes/patientRoutes';
import providerRoutes from './routes/providerRoutes';
import payorRoutes from './routes/payorRoutes';
import * as visitController from './controllers/visitController';
import * as claimController from './controllers/claimController';
import * as cptCodeController from './controllers/cptCodeController';
import * as ruleController from './controllers/ruleController';
import * as ruleExecutionController from './controllers/ruleExecutionController';
import * as insurancePolicyController from './controllers/insurancePolicyController';
import * as attachmentController from './controllers/attachmentController';
import { authenticateToken } from './middleware/auth';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/payors', payorRoutes);

// Protected routes for remaining entities
app.use(authenticateToken);

// Visit routes
app.get('/api/visits', visitController.getVisits);
app.get('/api/visits/:id', visitController.getVisitById);
app.post('/api/visits', visitController.createVisit);
app.put('/api/visits/:id', visitController.updateVisit);
app.delete('/api/visits/:id', visitController.deleteVisit);

// Claim routes
app.get('/api/claims', claimController.getClaims);
app.get('/api/claims/:id', claimController.getClaimById);
app.post('/api/claims', claimController.createClaim);
app.put('/api/claims/:id', claimController.updateClaim);
app.put('/api/claims/:id/status', claimController.updateClaimStatus);
app.delete('/api/claims/:id', claimController.deleteClaim);

// CPT Code routes
app.get('/api/cpt-codes', cptCodeController.getCPTCodes);
app.get('/api/cpt-codes/:id', cptCodeController.getCPTCodeById);
app.post('/api/cpt-codes', cptCodeController.createCPTCode);
app.put('/api/cpt-codes/:id', cptCodeController.updateCPTCode);
app.delete('/api/cpt-codes/:id', cptCodeController.deleteCPTCode);

// Rule routes
app.get('/api/rules', ruleController.getRules);
app.get('/api/rules/:id', ruleController.getRuleById);
app.post('/api/rules', ruleController.createRule);
app.put('/api/rules/:id', ruleController.updateRule);
app.put('/api/rules/:id/toggle', ruleController.toggleRuleStatus);
app.delete('/api/rules/:id', ruleController.deleteRule);

// Rule Execution routes
app.get('/api/rule-executions', ruleExecutionController.getRuleExecutions);
app.get('/api/rule-executions/:id', ruleExecutionController.getRuleExecutionById);

// Insurance Policy routes
app.get('/api/insurance-policies', insurancePolicyController.getInsurancePolicies);
app.get('/api/insurance-policies/:id', insurancePolicyController.getInsurancePolicyById);
app.put('/api/insurance-policies/:id', insurancePolicyController.updateInsurancePolicy);
app.delete('/api/insurance-policies/:id', insurancePolicyController.deleteInsurancePolicy);

// Attachment routes
app.get('/api/attachments', attachmentController.getAttachments);
app.post('/api/attachments', upload.single('file'), attachmentController.uploadAttachment);
app.get('/api/attachments/:id/download', attachmentController.downloadAttachment);
app.delete('/api/attachments/:id', attachmentController.deleteAttachment);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
});

export default app;
