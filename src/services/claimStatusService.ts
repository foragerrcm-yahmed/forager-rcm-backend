/**
 * Claim Status Recalculation Service
 *
 * Centralises the logic for determining a claim's status based on:
 *   - Whether the claim is self-pay (measured against billedAmount)
 *   - Or insurance (measured against contracted rates per service line)
 *   - Total received = sum of all PaymentPosting.paidAmount records for the claim
 *
 * Self-pay detection: payor.payorCategory matches /self.?pay|patient/i
 *
 * Status matrix:
 *   totalReceived === 0 && patientResponsibility > 0  → DeniedPatientResponsibility
 *   totalReceived === 0 && patientResponsibility === 0 → Denied
 *   totalReceived >= benchmark                         → Paid
 *   totalReceived > benchmark                          → Overpaid
 *   0 < totalReceived < benchmark                      → ShortPaid
 */

import { PrismaClient, ClaimStatus } from '../../generated/prisma';

const prisma = new PrismaClient();

const SELF_PAY_CATEGORY_RE = /self.?pay|patient/i;

// ─── Rate resolution ──────────────────────────────────────────────────────────

/**
 * Resolve the contracted rate for a single ClaimService line.
 * Priority: ClaimService.contractedRate → CPTCode.basePrice → null
 */
function resolveServiceRate(svc: {
  contractedRate?: any;
  cptCode?: { basePrice?: any } | null;
}): number | null {
  if (svc.contractedRate != null) return Number(svc.contractedRate);
  if (svc.cptCode?.basePrice != null) return Number(svc.cptCode.basePrice);
  return null;
}

// ─── Status resolution ────────────────────────────────────────────────────────

export function resolveClaimStatus(
  totalReceived: number,
  benchmark: number,
  patientResponsibility: number
): ClaimStatus {
  if (totalReceived === 0) {
    return patientResponsibility > 0 ? 'DeniedPatientResponsibility' : 'Denied';
  }
  if (totalReceived >= benchmark) {
    // Slightly over due to rounding → treat as Paid
    return totalReceived > benchmark * 1.001 ? 'Overpaid' : 'Paid';
  }
  return 'ShortPaid';
}

// ─── Main recalculation function ──────────────────────────────────────────────

export interface RecalcResult {
  newStatus: ClaimStatus;
  totalReceived: number;
  benchmark: number;
  isSelfPay: boolean;
}

/**
 * Recalculate the claim status by:
 *   1. Loading the claim with payor, services (+ cptCode), and all payment postings
 *   2. Determining if it's self-pay
 *   3. Computing the benchmark (contracted total or billedAmount)
 *   4. Summing all payment postings
 *   5. Returning the new status + metadata
 *
 * Does NOT write to the database — the caller is responsible for persisting.
 */
export async function recalculateClaimStatus(claimId: string): Promise<RecalcResult | null> {
  const claim = await prisma.claim.findUnique({
    where: { id: claimId },
    include: {
      payor: { select: { payorCategory: true } },
      services: {
        include: { cptCode: { select: { basePrice: true } } },
      },
      paymentPostings: {
        select: { paidAmount: true, patientResponsibility: true },
      },
    },
  });

  if (!claim) return null;

  // ── Self-pay detection ────────────────────────────────────────────────────
  const payorCategory: string = (claim.payor as any)?.payorCategory ?? '';
  const isSelfPay = SELF_PAY_CATEGORY_RE.test(payorCategory);

  // ── Benchmark ─────────────────────────────────────────────────────────────
  let benchmark: number;

  if (isSelfPay) {
    // Self-pay: compare against what was billed
    benchmark = Number(claim.billedAmount);
  } else {
    // Insurance: sum contracted rates per service line
    let totalContracted = 0;
    let hasRates = false;
    for (const svc of claim.services) {
      const rate = resolveServiceRate(svc);
      if (rate != null) {
        totalContracted += rate;
        hasRates = true;
      }
    }
    // Fallback to billedAmount if no contracted rates are on file
    benchmark = hasRates && totalContracted > 0 ? totalContracted : Number(claim.billedAmount);
  }

  // ── Total received ────────────────────────────────────────────────────────
  // Sum all payment postings (insurance ERA payments + manual patient payments)
  const totalReceived = claim.paymentPostings.reduce(
    (sum, p) => sum + Number(p.paidAmount),
    0
  );

  // Patient responsibility: use the most recent posting's value if available
  const latestPosting = claim.paymentPostings[claim.paymentPostings.length - 1];
  const patientResponsibility = latestPosting?.patientResponsibility
    ? Number(latestPosting.patientResponsibility)
    : Number(claim.patientResponsibility ?? 0);

  const newStatus = resolveClaimStatus(totalReceived, benchmark, patientResponsibility);

  return { newStatus, totalReceived, benchmark, isSelfPay };
}

/**
 * Recalculate and persist the new claim status.
 * Returns the updated status or null if the claim was not found.
 */
export async function applyClaimStatusRecalculation(
  claimId: string,
  updatedById: string,
  now: number
): Promise<ClaimStatus | null> {
  const result = await recalculateClaimStatus(claimId);
  if (!result) return null;

  await prisma.claim.update({
    where: { id: claimId },
    data: {
      status: result.newStatus,
      paidAmount: result.totalReceived > 0 ? result.totalReceived : undefined,
      updatedBy: { connect: { id: updatedById } },
      updatedAt: BigInt(now),
    },
  });

  return result.newStatus;
}
