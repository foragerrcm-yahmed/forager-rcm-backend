"use strict";
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
 * Clients never interact with Stedi IDs directly. The mapping layer
 * (MasterPayor table) translates org-level Payor records to Stedi routing IDs.
 *
 * Authentication: API key passed in Authorization header.
 * Base URL: https://healthcare.us.stedi.com/2024-04-01
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StediError = void 0;
exports.fetchStediPayorList = fetchStediPayorList;
exports.searchStediPayors = searchStediPayors;
exports.checkEligibility = checkEligibility;
exports.submitProfessionalClaim = submitProfessionalClaim;
exports.checkClaimStatus = checkClaimStatus;
exports.getEraReport = getEraReport;
exports.pollTransactions = pollTransactions;
const https_1 = __importDefault(require("https"));
const STEDI_BASE_URL = 'https://healthcare.us.stedi.com/2024-04-01';
const STEDI_API_KEY = process.env.STEDI_API_KEY || '';
// ─── HTTP helper ──────────────────────────────────────────────────────────────
async function stediRequest(method, path, body) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${STEDI_BASE_URL}${path}`);
        const payload = body ? JSON.stringify(body) : undefined;
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method,
            headers: {
                'Authorization': STEDI_API_KEY,
                'Content-Type': 'application/json',
                ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
            },
        };
        const req = https_1.default.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode && res.statusCode >= 400) {
                        reject(new StediError(res.statusCode, parsed.error || 'STEDI_ERROR', parsed.message || 'Stedi API error', parsed));
                    }
                    else {
                        resolve(parsed);
                    }
                }
                catch {
                    reject(new Error(`Failed to parse Stedi response: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (payload)
            req.write(payload);
        req.end();
    });
}
class StediError extends Error {
    constructor(statusCode, code, message, raw) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.raw = raw;
        this.name = 'StediError';
    }
}
exports.StediError = StediError;
// ─── Payer List & Sync ────────────────────────────────────────────────────────
/**
 * Fetch the full Stedi payer list (paginated).
 * Used by the nightly sync job to keep MasterPayor up to date.
 */
async function fetchStediPayorList(pageToken) {
    const path = `/payers${pageToken ? `?page_token=${pageToken}` : ''}`;
    return stediRequest('GET', path);
}
/**
 * Search Stedi payer list by name, ID, or alias.
 */
async function searchStediPayors(query) {
    const path = `/payers/search?q=${encodeURIComponent(query)}`;
    const result = await stediRequest('GET', path);
    return result.items || [];
}
// ─── Eligibility Check (270/271) ─────────────────────────────────────────────
/**
 * Submit a real-time eligibility check to Stedi.
 * Returns the full 271 response in JSON format.
 *
 * The payorStediId is looked up from MasterPayor.primaryPayorId before calling.
 * Clients never see this ID — it is resolved server-side.
 */
async function checkEligibility(req) {
    if (!STEDI_API_KEY) {
        throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
    }
    const controlNumber = String(Math.floor(Math.random() * 999999999)).padStart(9, '0');
    const body = {
        controlNumber,
        tradingPartnerServiceId: req.payorStediId,
        provider: {
            organizationName: req.providerOrgName,
            npi: req.providerNpi,
        },
        subscriber: {
            memberId: req.subscriberMemberId,
            firstName: req.subscriberFirstName,
            lastName: req.subscriberLastName,
            dateOfBirth: req.subscriberDob,
        },
        encounter: {
            serviceTypeCodes: req.serviceTypeCodes || ['30'],
            ...(req.dateOfService ? { dateOfService: req.dateOfService } : {}),
        },
    };
    return stediRequest('POST', '/change/medicalnetwork/eligibility/v3', body);
}
// ─── Professional Claim Submission (837P) ─────────────────────────────────────
/**
 * Submit a professional (837P) claim to Stedi.
 * Returns the transaction ID and initial status.
 *
 * The payorRoutingId is MasterPayor.primaryPayorId — never exposed to clients.
 */
async function submitProfessionalClaim(req) {
    if (!STEDI_API_KEY) {
        throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
    }
    const body = {
        tradingPartnerServiceId: req.payorRoutingId,
        tradingPartnerName: req.payorName,
        billing: {
            providerType: 'BillingProvider',
            npi: req.billingNpi,
            employerId: req.billingNpi, // fallback to NPI if no EIN
            organizationName: req.billingOrgName,
            ...(req.billingTaxonomy ? { taxonomyCode: req.billingTaxonomy } : {}),
            address: {
                address1: req.billingAddress.address1,
                city: req.billingAddress.city,
                state: req.billingAddress.state,
                postalCode: req.billingAddress.postalCode,
            },
        },
        subscriber: {
            memberId: req.subscriber.memberId,
            firstName: req.subscriber.firstName,
            lastName: req.subscriber.lastName,
            dateOfBirth: req.subscriber.dob,
            gender: req.subscriber.gender || 'U',
            ...(req.subscriber.address ? { address: req.subscriber.address } : {}),
        },
        claimInformation: {
            claimFilingCode: req.claimInfo.claimFilingCode || 'CI',
            patientControlNumber: req.claimInfo.patientControlNumber,
            claimChargeAmount: req.claimInfo.claimChargeAmount,
            placeOfServiceCode: req.claimInfo.placeOfServiceCode || '11',
            healthCareCodeInformation: req.claimInfo.diagnosisCodes.map((code, i) => ({
                diagnosisTypeCode: i === 0 ? 'ABK' : 'ABF', // ABK = principal, ABF = additional
                diagnosisCode: code,
            })),
            serviceFacilityLocation: {
                organizationName: req.billingOrgName,
                address: {
                    address1: req.billingAddress.address1,
                    city: req.billingAddress.city,
                    state: req.billingAddress.state,
                    postalCode: req.billingAddress.postalCode,
                },
            },
            serviceLines: req.claimInfo.serviceLines.map((line) => ({
                serviceDate: line.serviceDate,
                professionalService: {
                    procedureCode: line.procedureCode,
                    lineItemChargeAmount: line.lineItemChargeAmount,
                    placeOfServiceCode: line.placeOfServiceCode || req.claimInfo.placeOfServiceCode || '11',
                    ...(line.modifiers?.length ? { procedureModifiers: line.modifiers } : {}),
                    compositeDiagnosisCodePointers: {
                        diagnosisCodePointers: ['1'],
                    },
                },
                ...(line.quantity ? { serviceLineNumber: line.quantity } : {}),
            })),
        },
    };
    // Add dependent if patient is different from subscriber
    if (req.patient) {
        body.dependent = {
            firstName: req.patient.firstName,
            lastName: req.patient.lastName,
            dateOfBirth: req.patient.dob,
            gender: req.patient.gender || 'U',
            relationshipToSubscriberCode: req.patient.relationship || '19',
        };
    }
    return stediRequest('POST', '/claims/professional', body);
}
// ─── Claim Status Check (276/277) ─────────────────────────────────────────────
/**
 * Check the status of a previously submitted claim.
 */
async function checkClaimStatus(params) {
    if (!STEDI_API_KEY) {
        throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
    }
    const body = {
        controlNumber: String(Math.floor(Math.random() * 999999999)).padStart(9, '0'),
        tradingPartnerServiceId: params.payorRoutingId,
        providers: [{
                providerType: 'BillingProvider',
                npi: params.providerNpi,
                claimStatusTransactions: [{
                        patientControlNumber: params.patientControlNumber,
                        claimChargeAmount: params.claimChargeAmount,
                        claimServiceBeginDate: params.serviceDate,
                        subscriber: {
                            memberId: params.subscriberMemberId,
                            firstName: params.subscriberFirstName,
                            lastName: params.subscriberLastName,
                            dateOfBirth: params.subscriberDob,
                        },
                    }],
            }],
    };
    return stediRequest('POST', '/change/medicalnetwork/claimstatus/v1', body);
}
// ─── ERA / Remittance (835) ───────────────────────────────────────────────────
/**
 * Retrieve an 835 ERA report for a specific transaction.
 */
async function getEraReport(transactionId) {
    if (!STEDI_API_KEY) {
        throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
    }
    return stediRequest('GET', `/transactions/${transactionId}/835`);
}
/**
 * Poll for new transactions (ERAs, 277CAs, etc.) since last check.
 * Use pageToken for pagination.
 */
async function pollTransactions(params) {
    if (!STEDI_API_KEY) {
        throw new StediError(500, 'STEDI_NOT_CONFIGURED', 'STEDI_API_KEY environment variable is not set');
    }
    const qs = new URLSearchParams();
    if (params?.pageToken)
        qs.set('page_token', params.pageToken);
    if (params?.direction)
        qs.set('direction', params.direction);
    if (params?.transactionSetIdentifier)
        qs.set('transactionSetIdentifier', params.transactionSetIdentifier);
    const path = `/transactions${qs.toString() ? `?${qs.toString()}` : ''}`;
    return stediRequest('GET', path);
}
