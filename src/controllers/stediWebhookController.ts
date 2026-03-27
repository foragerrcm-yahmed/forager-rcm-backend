import { Request, Response } from 'express';
import { PrismaClient } from '../../generated/prisma';
import { processEra835 } from '../services/stedi.service';

const prisma = new PrismaClient();

/**
 * POST /api/webhooks/stedi
 *
 * Receives inbound events from Stedi (835 ERAs, 277 status updates, 999 acknowledgements).
 *
 * Multi-tenant routing:
 *   - The organizationId is resolved from the claim's patientControlNumber (= claimNumber)
 *   - No DEFAULT_ORGANIZATION_ID env var is used — we always look up the org from the data
 *   - All events are logged to StediWebhookLog for audit and replay
 *
 * Stedi sends a shared secret in the Authorization header.
 * Set STEDI_WEBHOOK_SECRET in Railway env to validate it.
 */
export async function handleStediWebhook(req: Request, res: Response): Promise<void> {
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
  const eventType: string = payload?.eventType ?? payload?.type ?? 'unknown';
  const transactionId: string | undefined = payload?.transactionId ?? payload?.id;

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
    } else if (eventType === '277' || eventType === 'claim.status.updated') {
      await handle277Status(payload, log.id);
    } else if (eventType === '999' || eventType === 'acknowledgement') {
      await handle999Ack(payload, log.id);
    } else {
      console.log(`Stedi webhook: unhandled event type "${eventType}"`, transactionId);
    }

    // Mark as processed
    await prisma.stediWebhookLog.update({
      where: { id: log.id },
      data: { processedAt: new Date() },
    });

    res.status(200).json({ received: true });
  } catch (e: any) {
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

// ─── 835 ERA handler ──────────────────────────────────────────────────────────

async function handle835Era(payload: any, logId: string) {
  const claimPayments: any[] = payload.claimPayments ?? payload.claims ?? [];

  if (claimPayments.length === 0) {
    console.log('Stedi 835: no claim payments in payload');
    return;
  }

  // Resolve organizationId from the first claim's patientControlNumber
  // Each ERA should only contain claims from one org (Stedi routes by NPI/TIN)
  const firstControlNumber = claimPayments[0]?.patientControlNumber;
  let organizationId: string | null = null;

  if (firstControlNumber) {
    const claim = await prisma.claim.findFirst({
      where: { claimNumber: firstControlNumber },
      select: { organizationId: true },
    });
    organizationId = claim?.organizationId ?? null;
  }

  if (!organizationId) {
    // Fall back: try to match any claim in the ERA
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
    throw new Error(
      `Could not resolve organizationId for ERA with ${claimPayments.length} claims. ` +
      `First control number: ${firstControlNumber}`
    );
  }

  // Update the webhook log with resolved org
  await prisma.stediWebhookLog.update({
    where: { id: logId },
    data: { organizationId },
  });

  await processEra835(payload, organizationId);
}

// ─── 277 status handler ───────────────────────────────────────────────────────

async function handle277Status(payload: any, logId: string) {
  const claimStatuses: any[] = payload.claimStatuses ?? [];

  for (const statusEntry of claimStatuses) {
    const patientControlNumber = statusEntry.patientControlNumber;
    if (!patientControlNumber) continue;

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
    const statusMap: Record<string, string> = {
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
          status: newStatus as any,
          stediStatus: statusCode,
          denialCode: statusEntry.categoryCode ?? null,
          denialReason: statusEntry.statusInformation ?? null,
        },
      });
    }
  }
}

// ─── 999 acknowledgement handler ─────────────────────────────────────────────

async function handle999Ack(payload: any, logId: string) {
  const transactionSetAcks: any[] = payload.transactionSetAcknowledgments ?? [];

  for (const ack of transactionSetAcks) {
    const transactionId = ack.transactionSetControlNumber ?? ack.transactionId;
    const accepted = ack.acknowledgmentCode === 'A' || ack.acknowledgmentCode === 'E';

    if (!transactionId) continue;

    const claim = await prisma.claim.findFirst({
      where: { stediTransactionId: transactionId },
    });

    if (!claim) continue;

    await prisma.stediWebhookLog.update({
      where: { id: logId },
      data: { claimId: claim.id, organizationId: claim.organizationId },
    });

    if (!accepted) {
      await prisma.claim.update({
        where: { id: claim.id },
        data: {
          stediStatus: 'rejected_999',
          status: 'Denied',
          denialReason: `999 rejection: ${ack.acknowledgmentCode} — ${ack.implementationTransactionSetSyntaxError ?? 'Unknown error'}`,
        },
      });
    } else {
      await prisma.claim.update({
        where: { id: claim.id },
        data: { stediStatus: 'acknowledged_999' },
      });
    }
  }
}
