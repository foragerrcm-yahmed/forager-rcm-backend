/**
 * Stedi Clearinghouse Integration Service
 *
 * Handles all communication with the Stedi healthcare API:
 *   - Real-time eligibility checks (270/271)
 *   - Professional claim submission (837P)
 *   - Claim status checks (276/277)
 *   - ERA / remittance retrieval (835)
 *   - MasterPayor sync from Stedi payer list
 *
 * Design decisions:
 *   - Insurance is modelled as PatientInsurance → PayorPlan → Payor (not InsurancePolicy)
 *   - stediPayorId lives on Payor as a separate field (not derived from MasterPayor)
 *   - Organization context is always passed explicitly for multi-tenant safety
 *   - Auth header uses "Key <api_key>" format as required by Stedi
 *   - No org ID is hard-coded — callers supply organizationId
 *
 * Base URL: https://healthcare.us.stedi.com/2024-04-01
 */

import https from 'https';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STEDI_BASE_URL = 'https://healthcare.us.stedi.com/2024-04-01';
const STEDI_API_KEY = process.env.STEDI_API_KEY || '';

// ─── Error class ─────────────────────────────────────────────────────────────

export class StediError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public raw?: any
  ) {
    super(message);
    this.name = 'StediError';
  }
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function stediRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: object
): Promise<T> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${STEDI_BASE_URL}${path}`);
    const payload = body ? JSON.stringify(body) : undefined;

    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        // Stedi requires "Key <api_key>" format — NOT "Bearer"
        'Authorization': `Key ${STEDI_API_KEY}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          // Stedi returns 200 even for some errors (e.g. eligibility AAA errors)
          // Check both HTTP status and response body for error indicators
          if (res.statusCode && res.statusCode >= 400) {
            const errorMsg = parsed.message
              || (parsed.errors?.[0]?.description)
              || 'Stedi API error';
            const errorCode = parsed.error || parsed.errors?.[0]?.code || 'STEDI_ERROR';
            reject(new StediError(res.statusCode, errorCode, errorMsg, parsed));
          } else if (parsed.status === 'ERROR' && parsed.errors?.length) {
            // Stedi returned 200 but with error status in body
            const errorMsg = parsed.errors[0]?.description || 'Stedi returned an error';
            const errorCode = parsed.errors[0]?.code || 'STEDI_ERROR';
            reject(new StediError(400, errorCode, errorMsg, parsed));
          } else {
            resolve(parsed as T);
          }
        } catch {
          reject(new Error(`Failed to parse Stedi response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function generateControlNumber(): string {
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

function formatDateForStedi(date: Date | number | bigint | null | undefined): string {
  if (!date) return '';
  // Handle BigInt Unix timestamps (seconds)
  if (typeof date === 'bigint' || typeof date === 'number') {
    const ms = typeof date === 'bigint' ? Number(date) * 1000 : date * 1000;
    return new Date(ms).toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
  }
  return (date as Date).toISOString().split('T')[0].replace(/-/g, '');
}

function mapGender(gender: string | null | undefined): string {
  if (!gender) return 'U';
  const g = gender.toLowerCase();
  if (g === 'male' || g === 'm') return 'M';
  if (g === 'female' || g === 'f') return 'F';
  return 'U';
}

function mapPlaceOfService(location: string | null | undefined): string {
  if (!location) return '11';
  if (location === 'Telehealth') return '02';
  return '11'; // InClinic / default = office
}

// ─── Eligibility — 270/271 ────────────────────────────────────────────────────

/**
 * Run a real-time eligibility check for a patient's insurance.
 *
 * @param patientInsuranceId  ID of the PatientInsurance record
 * @param organizationId      Org context for multi-tenant audit trail
 * @param visitId             Optional: link to a visit (pre-appointment check)
 */
export async function checkEligibility(
  patientInsuranceId: string,
  organizationId: string,
  visitId?: string
) {
  if (!STEDI_API_KEY) {
    throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
  }

  // Load the PatientInsurance record with patient, plan, payor, and masterPayor
  const patientInsurance = await prisma.patientInsurance.findUniqueOrThrow({
    where: { id: patientInsuranceId },
    include: {
      patient: true,
      plan: {
        include: {
          payor: {
            include: { masterPayor: true },
          },
        },
      },
    },
  });

  const patient = patientInsurance.patient;
  const payor = patientInsurance.plan.payor;

  // Resolve Stedi routing ID (priority order):
  // 1. payor.stediPayorId — org-level override
  // 2. payor.masterPayor.primaryPayorId — canonical Stedi routing ID from the master list
  // 3. payor.externalPayorId — legacy fallback
  const tradingPartnerServiceId =
    payor.stediPayorId ??
    (payor.masterPayor?.primaryPayorId) ??
    payor.externalPayorId;

  if (!tradingPartnerServiceId) {
    throw new StediError(
      400,
      'MISSING_STEDI_PAYOR_ID',
      `Payor "${payor.name}" has no Stedi routing ID. Set stediPayorId on the Payor record or link it to a Master Payor.`
    );
  }

  // Load the org's billing NPI
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { name: true, npi: true },
  });

  if (!org.npi) {
    throw new StediError(
      400,
      'MISSING_BILLING_NPI',
      'Organization billing NPI is required for eligibility checks. Set it in Configurations → Organization.'
    );
  }

  // Determine subscriber vs dependent
  // If insuredType is Dependent, the subscriber info may differ from the patient
  // subscriberName format: "FirstName LastName" or just use patient info
  let subscriberFirstName = patient.firstName;
  let subscriberLastName = patient.lastName;
  let subscriberDob = formatDateForStedi(patient.dateOfBirth);
  let subscriberGender = mapGender(patient.gender);

  if (patientInsurance.insuredType === 'Dependent' && patientInsurance.subscriberName) {
    const parts = patientInsurance.subscriberName.trim().split(/\s+/);
    subscriberFirstName = parts[0] || patient.firstName;
    subscriberLastName = parts.slice(1).join(' ') || patient.lastName;
    if (patientInsurance.subscriberDob) {
      subscriberDob = formatDateForStedi(patientInsurance.subscriberDob);
    }
  }

  const requestBody: any = {
    controlNumber: generateControlNumber(),
    tradingPartnerServiceId,
    provider: {
      organizationName: org.name,
      npi: org.npi,
    },
    subscriber: {
      memberId: patientInsurance.memberId,
      firstName: subscriberFirstName,
      lastName: subscriberLastName,
      ...(subscriberDob ? { dateOfBirth: subscriberDob } : {}),
      ...(subscriberGender !== 'U' ? { gender: subscriberGender } : {}),
    },
    encounter: {
      serviceTypeCodes: ['30'], // "Health Benefit Plan Coverage" — broad check
    },
  };

  // Add dependent info if patient is different from subscriber
  if (patientInsurance.insuredType === 'Dependent') {
    requestBody.dependents = [{
      firstName: patient.firstName,
      lastName: patient.lastName,
      ...(patient.dateOfBirth ? { dateOfBirth: formatDateForStedi(patient.dateOfBirth) } : {}),
      ...(patient.gender && mapGender(patient.gender) !== 'U' ? { gender: mapGender(patient.gender) } : {}),
    }];
  }

  // Create audit record before calling Stedi
  const eligibilityCheck = await prisma.eligibilityCheck.create({
    data: {
      patientId: patient.id,
      patientInsuranceId,
      visitId,
      organizationId,
      rawRequest: requestBody as any,
    },
  });

  let rawResponse: any;

  try {
    rawResponse = await stediRequest<any>('POST', '/change/medicalnetwork/eligibility/v3', requestBody);
  } catch (e: any) {
    // Store the error details for debugging
    const errorMessage = e instanceof StediError
      ? `${e.code}: ${e.message}`
      : e.message;
    await prisma.eligibilityCheck.update({
      where: { id: eligibilityCheck.id },
      data: {
        rawResponse: e instanceof StediError && e.raw ? e.raw : undefined,
        errorMessage,
      },
    });
    throw e;
  }

  // Parse the 271 response
  const parsed = parse271Response(rawResponse);

  // Update the audit record with parsed results
  const updated = await prisma.eligibilityCheck.update({
    where: { id: eligibilityCheck.id },
    data: {
      stediTransactionId: rawResponse.controlNumber,
      rawResponse,
      isEligible: parsed.isEligible,
      coverageActive: parsed.coverageActive,
      planName: parsed.planName,
      memberId: patientInsurance.memberId,
      copayAmount: parsed.copayAmount,
      deductibleTotal: parsed.deductibleTotal,
      deductibleMet: parsed.deductibleMet,
      deductibleRemaining: parsed.deductibleRemaining,
      oopTotal: parsed.oopTotal,
      oopMet: parsed.oopMet,
      oopRemaining: parsed.oopRemaining,
      therapyVisitsAllowed: parsed.therapyVisitsAllowed,
      therapyVisitsUsed: parsed.therapyVisitsUsed,
      therapyVisitsRemaining: parsed.therapyVisitsRemaining,
      requiresAuthorization: parsed.requiresAuthorization,
      coinsurancePercent: parsed.coinsurancePercent,
      groupNumber: parsed.groupNumber,
      coverageStartDate: parsed.coverageStartDate,
      coverageEndDate: parsed.coverageEndDate,
    },
  });

  return updated;
}

// ─── Claims Submission — 837P ─────────────────────────────────────────────────

/**
 * Submit a claim to Stedi as an 837P professional claim.
 * Insurance is queried separately via Patient → PatientInsurance.
 * Organization details (name, NPI) are loaded from the claim's organizationId.
 */
export async function submitClaim(claimId: string) {
  if (!STEDI_API_KEY) {
    throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
  }

  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: {
      patient: true,
      provider: true,
      payor: true,
      services: true,
      diagnoses: { orderBy: { sequence: 'asc' } },
      visit: { select: { location: true } },
      organization: { select: { name: true, npi: true, addresses: true } },
    },
  });

  if (!claim.provider.npi) {
    throw new StediError(400, 'MISSING_PROVIDER_NPI', 'Provider NPI is required for claim submission');
  }

  if (!claim.organization?.npi) {
    throw new StediError(
      400,
      'MISSING_BILLING_NPI',
      'Organization billing NPI is required. Set it in Configurations → Organization.'
    );
  }

  if (!claim.diagnoses || claim.diagnoses.length === 0) {
    throw new StediError(
      400,
      'MISSING_DIAGNOSES',
      'At least one diagnosis (ICD-10 code) is required for claim submission. Add diagnoses to the claim first.'
    );
  }

  // Query primary insurance separately via Patient → PatientInsurance
  const primaryInsurance = await prisma.patientInsurance.findFirst({
    where: {
      patientId: claim.patientId,
      isPrimary: true,
    },
    include: {
      plan: { include: { payor: { include: { masterPayor: true } } } },
    },
  });

  // Load the claim's payor with masterPayor for routing ID resolution
  const claimPayorWithMaster = await prisma.payor.findUnique({
    where: { id: claim.payor.id },
    include: { masterPayor: true },
  });

  const tradingPartnerServiceId =
    claim.payor.stediPayorId ??
    claimPayorWithMaster?.masterPayor?.primaryPayorId ??
    claim.payor.externalPayorId;

  if (!tradingPartnerServiceId) {
    throw new StediError(
      400,
      'MISSING_STEDI_PAYOR_ID',
      `Payor "${claim.payor.name}" has no Stedi routing ID. Set stediPayorId on the Payor record.`
    );
  }

  // Extract billing address from org's addresses JSON array
  const orgAddresses = (claim.organization.addresses as any[]) ?? [];
  const billingAddress = orgAddresses[0] ?? {};

  const requestBody = {
    controlNumber: generateControlNumber(),
    tradingPartnerServiceId,
    billingProvider: {
      npi: claim.organization.npi,
      taxonomyCode: claim.provider.taxonomyCode ?? '208000000X',
      organizationName: claim.organization.name,
      address: {
        address1: billingAddress.address1 ?? '',
        city: billingAddress.city ?? '',
        state: billingAddress.state ?? '',
        postalCode: billingAddress.postalCode ?? '',
      },
    },
    renderingProvider: {
      npi: claim.provider.npi,
      firstName: claim.provider.firstName ?? '',
      lastName: claim.provider.lastName ?? '',
      taxonomyCode: claim.provider.taxonomyCode ?? '208000000X',
    },
    subscriber: {
      memberId: primaryInsurance?.memberId ?? '',
      firstName: claim.patient.firstName,
      lastName: claim.patient.lastName,
      dateOfBirth: formatDateForStedi(claim.patient.dateOfBirth),
      gender: mapGender(claim.patient.gender),
    },
    claimInformation: {
      claimFilingCode: '11',
      patientControlNumber: claim.claimNumber,
      claimChargeAmount: Number(claim.billedAmount),
      placeOfServiceCode: mapPlaceOfService(claim.visit?.location),
      claimFrequencyCode: '1',
      signatureIndicator: 'Y',
      planParticipationCode: 'A',
      healthCareCodeInformation: claim.diagnoses.map((d, i) => ({
        diagnosisTypeCode: i === 0 ? 'ABK' : 'ABF',
        diagnosisCode: d.icdCode.replace('.', ''),
      })),
      serviceLines: claim.services.map((svc, idx) => ({
        serviceDate: formatDateForStedi(claim.serviceDate),
        professionalService: {
          procedureCode: svc.cptCodeCode ?? '',
          procedureModifiers: svc.modifiers
            ? Object.values(svc.modifiers as Record<string, string>)
            : [],
          lineItemChargeAmount: Number(svc.totalPrice),
          measurementUnit: 'UN',
          serviceUnitCount: svc.quantity,
          placeOfServiceCode: mapPlaceOfService(claim.visit?.location),
        },
        assignedNumber: idx + 1,
      })),
    },
  };

  // Mark claim as being submitted
  await prisma.claim.update({
    where: { id: claimId },
    data: { submittedToStediAt: new Date() },
  });

  let rawResponse: any;

  try {
    rawResponse = await stediRequest<any>('POST', '/claims/professional', requestBody);
  } catch (e: any) {
    await prisma.claim.update({
      where: { id: claimId },
      data: { submittedToStediAt: null, stediStatus: 'submission_failed' },
    });
    throw e;
  }

  // Store Stedi transaction ID and update status
  await prisma.claim.update({
    where: { id: claimId },
    data: {
      stediTransactionId: rawResponse.transactionId ?? rawResponse.controlNumber,
      stediStatus: 'submitted',
      status: 'Submitted',
      submissionDate: BigInt(Math.floor(Date.now() / 1000)),
    },
  });

  return rawResponse;
}

// ─── Claim Status — 276/277 ───────────────────────────────────────────────────

export async function getClaimStatus(claimId: string) {
  if (!STEDI_API_KEY) {
    throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
  }

  const claim = await prisma.claim.findUniqueOrThrow({
    where: { id: claimId },
    include: { provider: true, payor: true },
  });

  if (!claim.stediTransactionId) {
    throw new StediError(400, 'NOT_SUBMITTED', 'Claim has not been submitted to Stedi yet');
  }

  const tradingPartnerServiceId = claim.payor.stediPayorId ?? claim.payor.externalPayorId;

  const response = await stediRequest<any>('POST', '/claim-status/professional', {
    controlNumber: generateControlNumber(),
    tradingPartnerServiceId,
    providers: [{ npi: claim.provider.npi }],
    claimInformation: {
      patientControlNumber: claim.claimNumber,
      claimAmount: Number(claim.billedAmount),
      claimSubmissionDate: formatDateForStedi(
        claim.submissionDate ? Number(claim.submissionDate) : Date.now() / 1000
      ),
    },
  });

  const mapped = map277StatusToClaimStatus(response);

  if (mapped.status) {
    await prisma.claim.update({
      where: { id: claimId },
      data: {
        status: mapped.status as any,
        stediStatus: mapped.rawStatus,
        denialCode: mapped.denialCode,
        denialReason: mapped.denialReason,
      },
    });
  }

  return response;
}

// ─── ERA / Remittance — 835 ───────────────────────────────────────────────────

/**
 * Process an inbound 835 ERA payload.
 * organizationId is passed explicitly — never inferred from env — for multi-tenant safety.
 */
export async function processEra835(payload: any, organizationId: string) {
  const claimsInEra: any[] = payload.claimPayments ?? [];

  for (const eraClaim of claimsInEra) {
    // Match by patient control number (= our claimNumber), scoped to org
    const claim = await prisma.claim.findFirst({
      where: {
        claimNumber: eraClaim.patientControlNumber,
        organizationId,
      },
    });

    if (!claim) {
      console.warn(
        `ERA 835: no matching claim for "${eraClaim.patientControlNumber}" in org ${organizationId}`
      );
      continue;
    }

    const adjustments = (eraClaim.claimAdjustments ?? []).map((adj: any) => ({
      groupCode: adj.adjustmentGroupCode,
      reasonCode: adj.adjustmentReasonCode,
      amount: adj.adjustmentAmount,
    }));

    const primaryAdj = adjustments[0];

    await prisma.paymentPosting.create({
      data: {
        claimId: claim.id,
        organizationId,
        checkNumber: payload.checkNumber ?? null,
        checkDate: payload.checkDate ? new Date(payload.checkDate) : null,
        payerName: payload.payerName ?? null,
        payeeNpi: payload.payeeNpi ?? null,
        billedAmount: claim.billedAmount,
        allowedAmount: eraClaim.allowedAmount ?? null,
        paidAmount: eraClaim.paymentAmount ?? 0,
        patientResponsibility: eraClaim.patientResponsibility ?? null,
        adjustments,
        claimAdjustmentReason: primaryAdj
          ? `${primaryAdj.groupCode}-${primaryAdj.reasonCode}`
          : null,
        remarkCodes: (eraClaim.remarkCodes ?? []).join(','),
        rawEraSegment: eraClaim,
        isAutoPosted: true,
      },
    });

    const newStatus =
      eraClaim.paymentAmount > 0
        ? eraClaim.paymentAmount < Number(claim.billedAmount)
          ? 'ShortPaid'
          : 'Paid'
        : 'Denied';

    await prisma.claim.update({
      where: { id: claim.id },
      data: {
        status: newStatus as any,
        paidAmount: eraClaim.paymentAmount ?? 0,
        allowedAmount: eraClaim.allowedAmount ?? null,
        patientResponsibility: eraClaim.patientResponsibility ?? null,
        adjustmentAmount: adjustments.reduce(
          (sum: number, a: any) => sum + (a.amount ?? 0),
          0
        ),
        denialCode:
          newStatus === 'Denied' && primaryAdj
            ? `${primaryAdj.groupCode}-${primaryAdj.reasonCode}`
            : claim.denialCode,
      },
    });
  }
}

// ─── MasterPayor sync from Stedi payer list ───────────────────────────────────

export async function fetchStediPayorList(pageToken?: string): Promise<{
  items: any[];
  next_page_token?: string;
}> {
  if (!STEDI_API_KEY) {
    throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
  }

  const qs = new URLSearchParams();
  if (pageToken) qs.set('page_token', pageToken);
  const path = `/payers${qs.toString() ? `?${qs.toString()}` : ''}`;
  return stediRequest<any>('GET', path);
}

export async function searchStediPayors(query: string): Promise<any[]> {
  if (!STEDI_API_KEY) {
    throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
  }

  const qs = new URLSearchParams({ search: query });
  const result = await stediRequest<any>('GET', `/payers?${qs.toString()}`);
  return result.items ?? result ?? [];
}

// ─── 271 response parser ──────────────────────────────────────────────────────
//
// Benefit type codes (benefitsInformation[].code):
//   1  = Active Coverage
//   A  = Co-insurance (benefitPercent, e.g. "20" = 20%)
//   B  = Co-pay       (benefitAmount, fixed dollar)
//   C  = Deductible   (benefitAmount)
//   G  = Out-of-Pocket / Stop Loss (benefitAmount)
//   J  = Cost Containment (Medicaid deductible-like)
//   Y  = Spend Down
//
// timeQualifierCode values:
//   23 = Calendar Year (total/max)
//   24 = Year-to-Date (amount met so far)
//   26 = Remaining (some payers)
//   29 = Remaining (most common)
//   30 = Exceeded
//
// coverageLevelCode: IND = Individual, FAM = Family
// inPlanNetworkIndicatorCode: Y = In-network, N = Out-of-network, W = Both

function parse271Response(response: any) {
  const benefits: any[] = response?.benefitsInformation ?? [];

  // Filter helpers
  const byCode = (code: string) => benefits.filter((b: any) => b.code === code);

  // Prefer in-network (Y or W) individual-level entries; fall back to any match
  const preferInNetwork = (entries: any[]) => {
    const inNet = entries.filter(
      (b: any) => b.inPlanNetworkIndicatorCode === 'Y' || b.inPlanNetworkIndicatorCode === 'W'
    );
    return inNet.length > 0 ? inNet : entries;
  };

  const preferIndividual = (entries: any[]) => {
    const ind = entries.filter(
      (b: any) => !b.coverageLevelCode || b.coverageLevelCode === 'IND'
    );
    return ind.length > 0 ? ind : entries;
  };

  const pickBest = (code: string) => {
    const all = byCode(code);
    if (!all.length) return null;
    return preferIndividual(preferInNetwork(all))[0] ?? all[0];
  };

  // Find a specific time-qualified entry (e.g. remaining vs total)
  const pickByTimeQualifier = (code: string, ...tqCodes: string[]) => {
    const all = byCode(code);
    if (!all.length) return null;
    const pool = preferIndividual(preferInNetwork(all));
    for (const tq of tqCodes) {
      const match = pool.find((b: any) => b.timeQualifierCode === tq);
      if (match) return match;
    }
    return null;
  };

  // ── Deductible (code C) ──
  // timeQualifier 23 = calendar year total; 29/26 = remaining; 24 = met
  const deductibleTotal    = pickByTimeQualifier('C', '23');
  const deductibleRemaining = pickByTimeQualifier('C', '29', '26');
  const deductibleMet      = pickByTimeQualifier('C', '24');
  // Fallback: if no time-qualified entries, grab best single entry as total
  const deductibleFallback = !deductibleTotal && !deductibleRemaining ? pickBest('C') : null;

  // ── Out-of-Pocket (code G) ──
  const oopTotal     = pickByTimeQualifier('G', '23');
  const oopRemaining = pickByTimeQualifier('G', '29', '26');
  const oopMet       = pickByTimeQualifier('G', '24');
  const oopFallback  = !oopTotal && !oopRemaining ? pickBest('G') : null;

  // ── Co-pay (code B) — fixed dollar ──
  const copay = pickBest('B');

  // ── Co-insurance (code A) — percentage ──
  const coinsurance = pickBest('A');

  // ── Therapy visits (service type code 'PT' = Physical Therapy) ──
  // Look for quantity-based entries under PT service type
  const therapyBenefits = benefits.filter(
    (b: any) => b.serviceTypeCodes?.includes('PT') || b.serviceTypeCodes?.includes('50')
  );
  const therapyAllowed   = therapyBenefits.find((b: any) => b.timeQualifierCode === '27' || b.benefitQuantity);
  const therapyRemaining = therapyBenefits.find((b: any) => b.timeQualifierCode === '29' && b.benefitQuantity);
  const therapyUsed      = therapyBenefits.find((b: any) => b.timeQualifierCode === '24' && b.benefitQuantity);

  // ── Plan / group info ──
  const groupNumber = response?.planInformation?.groupNumber
    ?? response?.planInformation?.groupName
    ?? null;

  // ── Coverage dates ──
  const planDates = response?.planDateInformation ?? {};
  const coverageStartDate = planDates.eligibilityBegin ?? planDates.planBegin ?? null;
  const coverageEndDate   = planDates.eligibilityEnd   ?? planDates.planEnd   ?? null;

  // ── Active coverage: planStatus[0].statusCode === '1' ──
  const coverageActive = response?.planStatus?.[0]?.statusCode === '1';

  return {
    isEligible: coverageActive || benefits.some((b: any) => b.code === '1'),
    coverageActive,
    planName: response?.planStatus?.[0]?.planDetails ?? null,
    groupNumber,
    coverageStartDate,
    coverageEndDate,
    // Copay
    copayAmount: copay?.benefitAmount ? parseFloat(copay.benefitAmount) : null,
    // Coinsurance (percent, e.g. 20 = 20%)
    coinsurancePercent: coinsurance?.benefitPercent ? parseFloat(coinsurance.benefitPercent) : null,
    // Deductible
    deductibleTotal:     deductibleTotal?.benefitAmount     ? parseFloat(deductibleTotal.benefitAmount)     : (deductibleFallback?.benefitAmount ? parseFloat(deductibleFallback.benefitAmount) : null),
    deductibleMet:       deductibleMet?.benefitAmount       ? parseFloat(deductibleMet.benefitAmount)       : null,
    deductibleRemaining: deductibleRemaining?.benefitAmount ? parseFloat(deductibleRemaining.benefitAmount) : null,
    // Out-of-pocket
    oopTotal:     oopTotal?.benefitAmount     ? parseFloat(oopTotal.benefitAmount)     : (oopFallback?.benefitAmount ? parseFloat(oopFallback.benefitAmount) : null),
    oopMet:       oopMet?.benefitAmount       ? parseFloat(oopMet.benefitAmount)       : null,
    oopRemaining: oopRemaining?.benefitAmount ? parseFloat(oopRemaining.benefitAmount) : null,
    // Therapy visits
    therapyVisitsAllowed:   therapyAllowed?.benefitQuantity   ? parseFloat(therapyAllowed.benefitQuantity)   : null,
    therapyVisitsUsed:      therapyUsed?.benefitQuantity      ? parseFloat(therapyUsed.benefitQuantity)      : null,
    therapyVisitsRemaining: therapyRemaining?.benefitQuantity ? parseFloat(therapyRemaining.benefitQuantity) : null,
    // Auth
    requiresAuthorization: benefits.some(
      (b: any) => b.authorizationOrCertificationRequired === 'Y'
    ),
  };
}

// ─── 277 status mapper ────────────────────────────────────────────────────────

function map277StatusToClaimStatus(response: any) {
  const statusCode = response?.claimStatuses?.[0]?.statusCode;
  const categoryCode = response?.claimStatuses?.[0]?.categoryCode;

  const map: Record<string, string> = {
    '1': 'Submitted',
    '2': 'Submitted',
    '3': 'Pended',
    '4': 'Denied',
    '19': 'Paid',
    '20': 'Denied',
    '22': 'ShortPaid',
  };

  return {
    status: map[statusCode] ?? null,
    rawStatus: statusCode,
    denialCode: categoryCode ?? null,
    denialReason: response?.claimStatuses?.[0]?.statusInformation ?? null,
  };
}
