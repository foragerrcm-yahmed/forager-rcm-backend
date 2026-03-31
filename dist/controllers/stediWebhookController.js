"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStediWebhook = handleStediWebhook;
const prisma_1 = require("../../generated/prisma");
const stedi_service_1 = require("../services/stedi.service");
const prisma = new prisma_1.PrismaClient();
/**
 * POST /api/webhooks/stedi
 *
 * Receives inbound events from Stedi (835 ERAs, 277 status updates, 999 acknowledgements).
 *
 * Multi-tenant routing:
 *   - The organizationId is resolved from the claim's patientControlNumber (= claimNumber)
 *   - No DEFAULT_ORGANIZATION_ID env var is used — we always look up the org from the data
 *   - All events are logged to StediWebhookLog for audit and replay
 *   - Each event writes a ClaimTimeline entry so the UI timeline stays current
 *
 * Stedi sends a shared secret in the Authorization header.
 * Set STEDI_WEBHOOK_SECRET in Railway env to validate it.
 */
async function handleStediWebhook(req, res) {
    const webhookSecret = process.env.STEDI_WEBHOOK_SECRET;
    // Validate shared secret if configured
    if (webhookSecret) {
        const incomingSecret = req.headers['authorization'];
        if (incomingSecret !== `Key ${webhookSecret}`) {
            res.status(401).json({ error: 'Invalid webhook secret' });
            return;
        }
    }
    const payload = req.body;
    const eventType = payload?.eventType ?? payload?.type ?? 'unknown';
    const transactionId = payload?.transactionId ?? payload?.id;
    // Create the webhook log entry immediately (for audit trail even if processing fails)
    const log = await prisma.stediWebhookLog.create({
        data: {
            eventType,
            transactionId,
            rawPayload: payload,
        },
    });
    try {
        if (eventType === 'transaction.processed' || eventType === '835') {
            await handle835Era(payload, log.id);
        }
        else if (eventType === '277' || eventType === 'claim.status.updated') {
            await handle277Status(payload, log.id);
        }
        else if (eventType === '999' || eventType === 'acknowledgement') {
            await handle999Ack(payload, log.id);
        }
        else {
            console.log(`Stedi webhook: unhandled event type "${eventType}"`, transactionId);
        }
        // Mark as processed
        await prisma.stediWebhookLog.update({
            where: { id: log.id },
            data: { processedAt: new Date() },
        });
        res.status(200).json({ received: true });
    }
    catch (e) {
        console.error('Stedi webhook processing error:', e);
        await prisma.stediWebhookLog.update({
            where: { id: log.id },
            data: { error: e.message },
        });
        // Always return 200 to Stedi to prevent retries for logic errors
        // (retries are only useful for transient network failures)
        res.status(200).json({ received: true, processingError: e.message });
    }
}
// ─── Timeline helper ──────────────────────────────────────────────────────────
async function addTimelineEvent(claimId, action, notes, status) {
    await prisma.claimTimeline.create({
        data: {
            claimId,
            action,
            notes: notes ?? null,
            status: status ?? null,
            createdAt: BigInt(Math.floor(Date.now() / 1000)),
            // userId is null for system-generated events
        },
    });
}
// ─── 835 ERA handler ──────────────────────────────────────────────────────────
async function handle835Era(payload, logId) {
    const claimPayments = payload.claimPayments ?? payload.claims ?? [];
    if (claimPayments.length === 0) {
        console.log('Stedi 835: no claim payments in payload');
        return;
    }
    // Resolve organizationId from the first claim's patientControlNumber
    const firstControlNumber = claimPayments[0]?.patientControlNumber;
    let organizationId = null;
    if (firstControlNumber) {
        const claim = await prisma.claim.findFirst({
            where: { claimNumber: firstControlNumber },
            select: { organizationId: true },
        });
        organizationId = claim?.organizationId ?? null;
    }
    if (!organizationId) {
        for (const eraClaim of claimPayments) {
            const match = await prisma.claim.findFirst({
                where: { claimNumber: eraClaim.patientControlNumber },
                select: { organizationId: true },
            });
            if (match) {
                organizationId = match.organizationId;
                break;
            }
        }
    }
    if (!organizationId) {
        throw new Error(`Could not resolve organizationId for ERA with ${claimPayments.length} claims. ` +
            `First control number: ${firstControlNumber}`);
    }
    // Update the webhook log with resolved org
    await prisma.stediWebhookLog.update({
        where: { id: logId },
        data: { organizationId },
    });
    // processEra835 updates claim status and creates PaymentPosting records.
    // After it runs, write timeline events for each claim in the ERA.
    await (0, stedi_service_1.processEra835)(payload, organizationId);
    // Write timeline events for each claim payment
    for (const eraClaim of claimPayments) {
        const claim = await prisma.claim.findFirst({
            where: { claimNumber: eraClaim.patientControlNumber, organizationId },
            select: { id: true, status: true },
        });
        if (!claim)
            continue;
        const paid = Number(eraClaim.paymentAmount ?? 0);
        const allowed = Number(eraClaim.allowedAmount ?? 0);
        const patientResp = Number(eraClaim.patientResponsibility ?? 0);
        const adjustments = eraClaim.claimAdjustments ?? [];
        const remarkCodes = eraClaim.remarkCodes ?? [];
        // Build a human-readable summary
        const adjSummary = adjustments.length > 0
            ? adjustments.map((a) => `${a.adjustmentGroupCode}-${a.adjustmentReasonCode} ($${Number(a.adjustmentAmount).toFixed(2)})`).join(', ')
            : null;
        const remarkSummary = remarkCodes.length > 0
            ? `Remark codes: ${remarkCodes.join(', ')}`
            : null;
        const lines = [];
        if (allowed > 0)
            lines.push(`Allowed: $${allowed.toFixed(2)}`);
        if (paid > 0)
            lines.push(`Paid: $${paid.toFixed(2)}`);
        if (patientResp > 0)
            lines.push(`Patient responsibility: $${patientResp.toFixed(2)}`);
        if (adjSummary)
            lines.push(`Adjustments: ${adjSummary}`);
        if (remarkSummary)
            lines.push(remarkSummary);
        if (payload.checkNumber)
            lines.push(`Check #${payload.checkNumber}`);
        if (payload.payerName)
            lines.push(`Payer: ${payload.payerName}`);
        await addTimelineEvent(claim.id, '835 ERA Received', lines.join(' · '), claim.status);
    }
}
// ─── 277 status handler ───────────────────────────────────────────────────────
async function handle277Status(payload, logId) {
    const claimStatuses = payload.claimStatuses ?? [];
    for (const statusEntry of claimStatuses) {
        const patientControlNumber = statusEntry.patientControlNumber;
        if (!patientControlNumber)
            continue;
        const claim = await prisma.claim.findFirst({
            where: { claimNumber: patientControlNumber },
        });
        if (!claim) {
            console.warn(`Stedi 277: no claim found for control number "${patientControlNumber}"`);
            continue;
        }
        // Update webhook log with resolved org and claim
        await prisma.stediWebhookLog.update({
            where: { id: logId },
            data: { claimId: claim.id, organizationId: claim.organizationId },
        });
        const statusCode = statusEntry.statusCode;
        const statusMap = {
            '1': 'Submitted',
            '2': 'Submitted',
            '3': 'Pended',
            '4': 'Denied',
            '19': 'Paid',
            '20': 'Denied',
            '22': 'ShortPaid',
        };
        const newStatus = statusMap[statusCode];
        if (newStatus) {
            await prisma.claim.update({
                where: { id: claim.id },
                data: {
                    status: newStatus,
                    stediStatus: statusCode,
                    denialCode: statusEntry.categoryCode ?? null,
                    denialReason: statusEntry.statusInformation ?? null,
                },
            });
        }
        // Write timeline event
        const statusLabel = newStatus ?? `Status ${statusCode}`;
        const tradingPartnerClaimNumber = statusEntry.tradingPartnerClaimNumber;
        const notes = [
            statusEntry.statusInformation,
            tradingPartnerClaimNumber ? `Payer claim #: ${tradingPartnerClaimNumber}` : null,
        ].filter(Boolean).join(' · ');
        await addTimelineEvent(claim.id, '277 Status Update', notes || `Status code ${statusCode}`, statusLabel);
    }
}
// ─── 999 acknowledgement handler ─────────────────────────────────────────────
async function handle999Ack(payload, logId) {
    const transactionSetAcks = payload.transactionSetAcknowledgments ?? [];
    for (const ack of transactionSetAcks) {
        const transactionId = ack.transactionSetControlNumber ?? payload.transactionId;
        const accepted = ack.acknowledgmentCode === 'A' || ack.acknowledgmentCode === 'E';
        if (!transactionId)
            continue;
        const claim = await prisma.claim.findFirst({
            where: { stediTransactionId: transactionId },
        });
        if (!claim)
            continue;
        await prisma.stediWebhookLog.update({
            where: { id: logId },
            data: { claimId: claim.id, organizationId: claim.organizationId },
        });
        if (!accepted) {
            const rejectionReason = `999 rejection: ${ack.acknowledgmentCode} — ${ack.implementationTransactionSetSyntaxError ?? 'Unknown error'}`;
            await prisma.claim.update({
                where: { id: claim.id },
                data: {
                    stediStatus: 'rejected_999',
                    status: 'Denied',
                    denialReason: rejectionReason,
                },
            });
            await addTimelineEvent(claim.id, '999 Acknowledgement — Rejected', rejectionReason, 'Denied');
        }
        else {
            await prisma.claim.update({
                where: { id: claim.id },
                data: { stediStatus: 'acknowledged_999' },
            });
            await addTimelineEvent(claim.id, '999 Acknowledgement — Accepted', 'EDI accepted by clearinghouse. Forwarding to payer.', 'Submitted');
        }
    }
}
