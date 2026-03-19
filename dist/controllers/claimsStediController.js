"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitClaimToStedi = submitClaimToStedi;
exports.checkClaimStatusFromStedi = checkClaimStatusFromStedi;
const stedi_service_1 = require("../services/stedi.service");
/**
 * POST /api/claims/:id/submit
 * Submit a claim to Stedi as an 837P professional claim.
 */
async function submitClaimToStedi(req, res) {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            res.status(401).json({ error: 'Organization context is required' });
            return;
        }
        const result = await (0, stedi_service_1.submitClaim)(id);
        res.status(200).json({
            success: true,
            message: 'Claim submitted to Stedi successfully',
            data: result,
        });
    }
    catch (e) {
        if (e instanceof stedi_service_1.StediError) {
            res.status(e.statusCode).json({
                error: e.code,
                message: e.message,
                raw: e.raw,
            });
        }
        else {
            console.error('Claim submission error:', e);
            res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
        }
    }
}
/**
 * GET /api/claims/:id/status
 * Check the status of a submitted claim via Stedi 276/277.
 */
async function checkClaimStatusFromStedi(req, res) {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organizationId;
        if (!organizationId) {
            res.status(401).json({ error: 'Organization context is required' });
            return;
        }
        const result = await (0, stedi_service_1.getClaimStatus)(id);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (e) {
        if (e instanceof stedi_service_1.StediError) {
            res.status(e.statusCode).json({
                error: e.code,
                message: e.message,
                raw: e.raw,
            });
        }
        else {
            console.error('Claim status check error:', e);
            res.status(500).json({ error: 'INTERNAL_ERROR', message: e.message });
        }
    }
}
