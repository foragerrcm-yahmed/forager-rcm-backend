"use strict";
/**
 * testDataSeeder.ts
 *
 * Creates a complete set of test records for eligibility testing:
 *   1. Aetna Payor (linked to MasterPayor) + PPO Plan
 *   2. Test Patient "John Doe" with Aetna insurance (Stedi sandbox member AETNA9wcSu)
 *   3. Test Provider "Dr. Alex Test" (MD, with NPI)
 *   4. Test Visit linking patient + provider (Upcoming, today)
 *
 * Uses Stedi's sandbox member ID AETNA9wcSu (subscriber: John Doe)
 * which returns a valid Aetna 271 response with active coverage.
 *
 * Idempotent — safe to run multiple times (upserts by name/externalId).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedTestData = seedTestData;
const prisma_1 = require("../../generated/prisma");
const prisma = new prisma_1.PrismaClient();
async function seedTestData(organizationId) {
    const now = BigInt(Math.floor(Date.now() / 1000));
    // ── Resolve target orgs ──────────────────────────────────────────────────────
    const orgs = organizationId
        ? await prisma.organization.findMany({ where: { id: organizationId } })
        : await prisma.organization.findMany();
    if (!orgs.length) {
        throw new Error('No organizations found in the database.');
    }
    // ── Find the Aetna MasterPayor ───────────────────────────────────────────────
    const aetnaMaster = await prisma.masterPayor.findUnique({
        where: { stediId: 'aetna' },
    });
    if (!aetnaMaster) {
        throw new Error('Aetna MasterPayor not found. Run seed-master-payors first.');
    }
    const results = [];
    for (const org of orgs) {
        // ── 1. Get or create a system user for this org to use as createdById ──────
        const systemUser = await prisma.user.findFirst({
            where: { organizationId: org.id },
            orderBy: { createdAt: 'asc' },
        });
        if (!systemUser) {
            console.warn(`[testDataSeeder] No users found for org ${org.id} — skipping`);
            continue;
        }
        // ── 2. Ensure org has a billing NPI (use a test NPI if not set) ───────────
        if (!org.npi) {
            await prisma.organization.update({
                where: { id: org.id },
                data: { npi: '1999999984', updatedAt: now },
            });
        }
        // ── 3. Upsert Aetna Payor for this org ────────────────────────────────────
        const externalPayorId = `aetna-test-${org.id.slice(0, 8)}`;
        let payor = await prisma.payor.findUnique({
            where: { externalPayorId },
        });
        if (!payor) {
            payor = await prisma.payor.create({
                data: {
                    name: 'Aetna (Test)',
                    externalPayorId,
                    payorCategory: 'Commercial',
                    billingTaxonomy: 'Medical',
                    masterPayorId: aetnaMaster.id,
                    organizationId: org.id,
                    createdById: systemUser.id,
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        else if (!payor.masterPayorId) {
            // Ensure masterPayorId is set on existing payor
            payor = await prisma.payor.update({
                where: { id: payor.id },
                data: { masterPayorId: aetnaMaster.id, updatedAt: now },
            });
        }
        // ── 4. Upsert Aetna PPO Plan ──────────────────────────────────────────────
        let plan = await prisma.payorPlan.findFirst({
            where: { payorId: payor.id, planName: 'Aetna Choice POS II (Test)' },
        });
        if (!plan) {
            plan = await prisma.payorPlan.create({
                data: {
                    payorId: payor.id,
                    planName: 'Aetna Choice POS II (Test)',
                    planType: 'PPO',
                    isInNetwork: true,
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        // ── 5. Upsert Test Patient "John Doe" ─────────────────────────────────────
        // Stedi sandbox test case: subscriber John Doe, memberId AETNA9wcSu
        // The dependent Jordan Doe (DOB 2001-07-14) is John's child
        let patient = await prisma.patient.findFirst({
            where: {
                organizationId: org.id,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe.test@example.com',
            },
        });
        if (!patient) {
            // DOB: 1975-03-20 as unix timestamp (subscriber)
            const dob = BigInt(Math.floor(new Date('1975-03-20').getTime() / 1000));
            patient = await prisma.patient.create({
                data: {
                    firstName: 'John',
                    lastName: 'Doe',
                    dateOfBirth: dob,
                    gender: 'M',
                    phone: '5555550100',
                    email: 'john.doe.test@example.com',
                    address: {
                        street: '123 Sunnyvale Lane',
                        city: 'South Godfreyview',
                        state: 'NY',
                        zip: '10144',
                    },
                    organizationId: org.id,
                    source: 'Forager',
                    createdById: systemUser.id,
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        // ── 6. Upsert Aetna Insurance Policy for John ─────────────────────────────
        // Stedi sandbox member ID: AETNA9wcSu — returns valid Aetna 271 with active coverage
        let insurance = await prisma.patientInsurance.findFirst({
            where: { patientId: patient.id, planId: plan.id },
        });
        if (!insurance) {
            insurance = await prisma.patientInsurance.create({
                data: {
                    patientId: patient.id,
                    planId: plan.id,
                    isPrimary: true,
                    insuredType: 'Subscriber',
                    memberId: 'AETNA9wcSu', // Stedi sandbox test member ID for Aetna
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        else if (insurance.memberId !== 'AETNA9wcSu') {
            // Update to correct member ID if it was previously wrong
            insurance = await prisma.patientInsurance.update({
                where: { id: insurance.id },
                data: { memberId: 'AETNA9wcSu', updatedAt: now },
            });
        }
        // ── 7. Upsert Test Provider "Dr. Alex Test" ───────────────────────────────
        let provider = await prisma.provider.findFirst({
            where: {
                organizationId: org.id,
                firstName: 'Alex',
                lastName: 'Test',
            },
        });
        if (!provider) {
            provider = await prisma.provider.create({
                data: {
                    firstName: 'Alex',
                    lastName: 'Test',
                    npi: '1234567893',
                    specialty: 'Internal Medicine',
                    licenseType: 'MD',
                    taxonomyCode: '207R00000X', // Internal Medicine
                    organizationId: org.id,
                    source: 'Forager',
                    createdById: systemUser.id,
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        // ── 8. Upsert Test Visit ──────────────────────────────────────────────────
        const todayMidnight = BigInt(Math.floor(new Date().setHours(0, 0, 0, 0) / 1000));
        const nineAm = BigInt(Math.floor(new Date().setHours(9, 0, 0, 0) / 1000));
        let visit = await prisma.visit.findFirst({
            where: {
                organizationId: org.id,
                patientId: patient.id,
                providerId: provider.id,
                visitDate: todayMidnight,
            },
        });
        if (!visit) {
            visit = await prisma.visit.create({
                data: {
                    patientId: patient.id,
                    providerId: provider.id,
                    visitDate: todayMidnight,
                    visitTime: nineAm,
                    duration: 30,
                    visitType: 'NewPatient',
                    location: 'InClinic',
                    status: 'Upcoming',
                    organizationId: org.id,
                    source: 'Forager',
                    createdById: systemUser.id,
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        results.push({
            orgId: org.id,
            orgName: org.name,
            payorId: payor.id,
            planId: plan.id,
            patientId: patient.id,
            providerId: provider.id,
            visitId: visit.id,
            insuranceId: insurance.id,
            memberId: insurance.memberId,
        });
    }
    return results;
}
