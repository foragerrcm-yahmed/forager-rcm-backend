"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const organizationRoutes_1 = __importDefault(require("./routes/organizationRoutes"));
const patientRoutes_1 = __importDefault(require("./routes/patientRoutes"));
const providerRoutes_1 = __importDefault(require("./routes/providerRoutes"));
const payorRoutes_1 = __importDefault(require("./routes/payorRoutes"));
const visitRoutes_1 = __importDefault(require("./routes/visitRoutes"));
const claimRoutes_1 = __importDefault(require("./routes/claimRoutes"));
const cptCodeRoutes_1 = __importDefault(require("./routes/cptCodeRoutes"));
const ruleRoutes_1 = __importDefault(require("./routes/ruleRoutes"));
const ruleExecutionRoutes_1 = __importDefault(require("./routes/ruleExecutionRoutes"));
const insurancePolicyRoutes_1 = __importDefault(require("./routes/insurancePolicyRoutes"));
const attachmentRoutes_1 = __importDefault(require("./routes/attachmentRoutes"));
const masterPayorRoutes_1 = __importDefault(require("./routes/masterPayorRoutes"));
const eligibilityRoutes_1 = __importDefault(require("./routes/eligibilityRoutes"));
const stediWebhookRoutes_1 = __importDefault(require("./routes/stediWebhookRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
// Load environment variables
dotenv_1.default.config();
// Global BigInt serialization fix for JSON responses
BigInt.prototype.toJSON = function () {
    return Number(this);
};
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api/auth', authRoutes_1.default);
app.use('/api/users', userRoutes_1.default);
app.use('/api/organizations', organizationRoutes_1.default);
app.use('/api/patients', patientRoutes_1.default);
app.use('/api/providers', providerRoutes_1.default);
app.use('/api/payors', payorRoutes_1.default);
app.use('/api/visits', visitRoutes_1.default);
app.use('/api/claims', claimRoutes_1.default);
app.use('/api/cpt-codes', cptCodeRoutes_1.default);
app.use('/api/rules', ruleRoutes_1.default);
app.use('/api/rule-executions', ruleExecutionRoutes_1.default);
app.use('/api/insurance-policies', insurancePolicyRoutes_1.default);
app.use('/api/attachments', attachmentRoutes_1.default);
app.use('/api/master-payors', masterPayorRoutes_1.default);
app.use('/api/eligibility', eligibilityRoutes_1.default);
app.use('/api/webhooks/stedi', stediWebhookRoutes_1.default);
app.use('/api/admin', adminRoutes_1.default);
// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});
// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
    console.log(`📊 API endpoints available at http://localhost:${PORT}/api/`);
});
exports.default = app;
