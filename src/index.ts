import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import organizationRoutes from './routes/organizationRoutes';
import patientRoutes from './routes/patientRoutes';
import providerRoutes from './routes/providerRoutes';
import payorRoutes from './routes/payorRoutes';
import visitRoutes from './routes/visitRoutes';
import claimRoutes from './routes/claimRoutes';
import cptCodeRoutes from './routes/cptCodeRoutes';
import ruleRoutes from './routes/ruleRoutes';
import ruleExecutionRoutes from './routes/ruleExecutionRoutes';
import insurancePolicyRoutes from './routes/insurancePolicyRoutes';
import attachmentRoutes from './routes/attachmentRoutes';
import masterPayorRoutes from './routes/masterPayorRoutes';
import eligibilityRoutes from './routes/eligibilityRoutes';
import stediWebhookRoutes from './routes/stediWebhookRoutes';
import adminRoutes from './routes/adminRoutes';

// Load environment variables
dotenv.config();

// Global BigInt serialization fix for JSON responses
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const app: Application = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/payors', payorRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/cpt-codes', cptCodeRoutes);
app.use('/api/rules', ruleRoutes);
app.use('/api/rule-executions', ruleExecutionRoutes);
app.use('/api/insurance-policies', insurancePolicyRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/master-payors', masterPayorRoutes);
app.use('/api/eligibility', eligibilityRoutes);
app.use('/api/webhooks/stedi', stediWebhookRoutes);
app.use('/api/admin', adminRoutes);

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
  console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
});

export default app;
