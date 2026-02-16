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

// Global BigInt serialization for JSON
(BigInt.prototype as any).toJSON = function() {
  return Number(this);
};

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

// Visit routes (protected)
app.get('/api/visits', authenticateToken, visitController.getVisits);
app.get('/api/visits/:id', authenticateToken, visitController.getVisitById);
app.post('/api/visits', authenticateToken, visitController.createVisit);
app.put('/api/visits/:id', authenticateToken, visitController.updateVisit);
app.delete('/api/visits/:id', authenticateToken, visitController.deleteVisit);

// Claim routes (protected)
app.get('/api/claims', authenticateToken, claimController.getClaims);
app.get('/api/claims/:id', authenticateToken, claimController.getClaimById);
app.post('/api/claims', authenticateToken, claimController.createClaim);
app.put('/api/claims/:id', authenticateToken, claimController.updateClaim);
app.put('/api/claims/:id/status', authenticateToken, claimController.updateClaimStatus);
app.delete('/api/claims/:id', authenticateToken, claimController.deleteClaim);

// CPT Code routes (protected)
app.get('/api/cpt-codes', authenticateToken, cptCodeController.getCPTCodes);
app.get('/api/cpt-codes/:id', authenticateToken, cptCodeController.getCPTCodeById);
app.post('/api/cpt-codes', authenticateToken, cptCodeController.createCPTCode);
app.put('/api/cpt-codes/:id', authenticateToken, cptCodeController.updateCPTCode);
app.delete('/api/cpt-codes/:id', authenticateToken, cptCodeController.deleteCPTCode);

// Rule routes (protected)
app.get('/api/rules', authenticateToken, ruleController.getRules);
app.get('/api/rules/:id', authenticateToken, ruleController.getRuleById);
app.post('/api/rules', authenticateToken, ruleController.createRule);
app.put('/api/rules/:id', authenticateToken, ruleController.updateRule);
app.put('/api/rules/:id/toggle', authenticateToken, ruleController.toggleRuleStatus);
app.delete('/api/rules/:id', authenticateToken, ruleController.deleteRule);

// Rule Execution routes (protected)
app.get('/api/rule-executions', authenticateToken, ruleExecutionController.getRuleExecutions);
app.get('/api/rule-executions/:id', authenticateToken, ruleExecutionController.getRuleExecutionById);

// Insurance Policy routes (protected)
app.get('/api/insurance-policies', authenticateToken, insurancePolicyController.getInsurancePolicies);
app.get('/api/insurance-policies/:id', authenticateToken, insurancePolicyController.getInsurancePolicyById);
app.put('/api/insurance-policies/:id', authenticateToken, insurancePolicyController.updateInsurancePolicy);
app.delete('/api/insurance-policies/:id', authenticateToken, insurancePolicyController.deleteInsurancePolicy);

// Attachment routes (protected)
app.get('/api/attachments', authenticateToken, attachmentController.getAttachments);
app.post('/api/attachments', authenticateToken, upload.single('file'), attachmentController.uploadAttachment);
app.get('/api/attachments/:id/download', authenticateToken, attachmentController.downloadAttachment);
app.delete('/api/attachments/:id', authenticateToken, attachmentController.deleteAttachment);

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
