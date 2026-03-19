"use strict";
/**
 * testDataSeeder.ts
 *
 * Creates a complete set of test records for eligibility testing:
 *   1. Aetna Payor (linked to MasterPayor) + PPO Plan
 *   2. Test Patient "Jane Doe" with Aetna insurance (Stedi sandbox member ID)
 *   3. Test Provider "Dr. Test Provider" (MD, with NPI)
 *   4. Test Visit linking patient + provider (Upcoming, today)
 *
 * Uses Stedi's sandbox member ID W000000000 which always returns a valid 271.
 * Idempotent — safe to run multiple times (upserts by name/externalId).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedTestData = seedTestData;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
                data: { npi: '1234567890', updatedAt: now },
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
        // ── 4. Upsert Aetna PPO Plan ──────────────────────────────────────────────
        let plan = await prisma.payorPlan.findFirst({
            where: { payorId: payor.id, planName: 'Aetna PPO (Test)' },
        });
        if (!plan) {
            plan = await prisma.payorPlan.create({
                data: {
                    payorId: payor.id,
                    planName: 'Aetna PPO (Test)',
                    planType: 'PPO',
                    isInNetwork: true,
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        // ── 5. Upsert Test Patient "Jane Doe" ─────────────────────────────────────
        let patient = await prisma.patient.findFirst({
            where: {
                organizationId: org.id,
                firstName: 'Jane',
                lastName: 'Doe',
            },
        });
        if (!patient) {
            // DOB: 1990-01-15 as unix timestamp
            const dob = BigInt(new Date('1990-01-15').getTime() / 1000);
            patient = await prisma.patient.create({
                data: {
                    firstName: 'Jane',
                    lastName: 'Doe',
                    dateOfBirth: dob,
                    gender: 'F',
                    phone: '5555550100',
                    email: 'jane.doe.test@example.com',
                    address: {
                        street: '123 Test Street',
                        city: 'Hartford',
                        state: 'CT',
                        zip: '06101',
                    },
                    organizationId: org.id,
                    source: 'Forager',
                    createdById: systemUser.id,
                    createdAt: now,
                    updatedAt: now,
                },
            });
        }
        // ── 6. Upsert Aetna Insurance Policy for Jane ─────────────────────────────
        // Stedi sandbox member ID: W000000000 — always returns a valid 271 response
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
                    memberId: 'W000000000', // Stedi sandbox test member ID
                    createdAt: now,
                    updatedAt: now,
                },
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
        });
    }
    return results;
}
