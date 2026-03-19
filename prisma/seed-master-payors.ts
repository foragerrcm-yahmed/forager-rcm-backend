/**
 * Seed script: MasterPayor canonical list with payor hierarchy.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json prisma/seed-master-payors.ts
 *
 * Structure:
 *   - Top-level payors have no parentId
 *   - BCBS state plans are children of the BCBS National parent
 *   - Medicaid state plans are children of the Medicaid National parent
 *   - Stedi IDs are the stable internal identifiers used for clearinghouse routing
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Transaction support presets ──────────────────────────────────────────────
const FULL = {
  eligibilityCheck: 'SUPPORTED',
  professionalClaimSubmission: 'SUPPORTED',
  institutionalClaimSubmission: 'SUPPORTED',
  claimStatus: 'SUPPORTED',
  claimPayment: 'SUPPORTED',
};
const ELIGIBILITY_ONLY = {
  eligibilityCheck: 'SUPPORTED',
  professionalClaimSubmission: 'ENROLLMENT_REQUIRED',
  institutionalClaimSubmission: 'ENROLLMENT_REQUIRED',
  claimStatus: 'SUPPORTED',
  claimPayment: 'NOT_SUPPORTED',
};
const CLAIMS_NO_ERA = {
  eligibilityCheck: 'SUPPORTED',
  professionalClaimSubmission: 'SUPPORTED',
  institutionalClaimSubmission: 'SUPPORTED',
  claimStatus: 'SUPPORTED',
  claimPayment: 'NOT_SUPPORTED',
};

// ─── Top-level payors ─────────────────────────────────────────────────────────
const TOP_LEVEL = [
  {
    stediId: 'bcbs-national',
    displayName: 'Blue Cross Blue Shield (National)',
    primaryPayorId: 'BCBS',
    aliases: ['Blue Cross', 'Blue Shield', 'BCBS', 'BCBSA'],
    coverageTypes: ['medical', 'dental', 'vision'],
    transactionSupport: ELIGIBILITY_ONLY,
  },
  {
    stediId: 'aetna',
    displayName: 'Aetna',
    primaryPayorId: '60054',
    aliases: ['Aetna Health', 'CVS Aetna', 'AET'],
    coverageTypes: ['medical', 'dental', 'vision', 'behavioral'],
    transactionSupport: FULL,
  },
  {
    stediId: 'cigna',
    displayName: 'Cigna',
    primaryPayorId: '62308',
    aliases: ['Cigna Healthcare', 'Cigna Health', 'CIGNA'],
    coverageTypes: ['medical', 'dental', 'vision', 'behavioral'],
    transactionSupport: FULL,
  },
  {
    stediId: 'uhc',
    displayName: 'UnitedHealthcare',
    primaryPayorId: '87726',
    aliases: ['UHC', 'United Healthcare', 'United Health Group', 'UHG'],
    coverageTypes: ['medical', 'dental', 'vision', 'behavioral'],
    transactionSupport: FULL,
  },
  {
    stediId: 'humana',
    displayName: 'Humana',
    primaryPayorId: '61101',
    aliases: ['Humana Health', 'HUM'],
    coverageTypes: ['medical', 'dental', 'vision'],
    transactionSupport: FULL,
  },
  {
    stediId: 'anthem',
    displayName: 'Anthem (Elevance Health)',
    primaryPayorId: '00710',
    aliases: ['Anthem Blue Cross', 'Anthem BCBS', 'Elevance Health', 'WellPoint'],
    coverageTypes: ['medical', 'dental', 'vision', 'behavioral'],
    transactionSupport: FULL,
  },
  {
    stediId: 'medicare',
    displayName: 'Medicare (CMS)',
    primaryPayorId: 'MEDICARE',
    aliases: ['CMS Medicare', 'Medicare Part B', 'Medicare FFS', 'HCFA'],
    coverageTypes: ['medical'],
    transactionSupport: FULL,
  },
  {
    stediId: 'medicaid-national',
    displayName: 'Medicaid (National)',
    primaryPayorId: 'MEDICAID',
    aliases: ['Medicaid', 'CMS Medicaid', 'State Medicaid'],
    coverageTypes: ['medical', 'dental', 'vision', 'behavioral'],
    transactionSupport: ELIGIBILITY_ONLY,
  },
  {
    stediId: 'tricare',
    displayName: 'TRICARE',
    primaryPayorId: 'TRICARE',
    aliases: ['Defense Health Agency', 'DHA', 'CHAMPUS', 'Military Health'],
    coverageTypes: ['medical', 'dental'],
    transactionSupport: FULL,
  },
  {
    stediId: 'oscar',
    displayName: 'Oscar Health',
    primaryPayorId: 'OSCAR1',
    aliases: ['Oscar', 'Oscar Insurance'],
    coverageTypes: ['medical'],
    transactionSupport: CLAIMS_NO_ERA,
  },
  {
    stediId: 'molina',
    displayName: 'Molina Healthcare',
    primaryPayorId: 'MOLINA',
    aliases: ['Molina', 'Molina Health'],
    coverageTypes: ['medical', 'behavioral'],
    transactionSupport: FULL,
  },
  {
    stediId: 'centene',
    displayName: 'Centene / WellCare',
    primaryPayorId: 'CENTENE',
    aliases: ['WellCare', 'Centene Corporation', 'Ambetter', 'Health Net'],
    coverageTypes: ['medical', 'behavioral'],
    transactionSupport: FULL,
  },
  {
    stediId: 'kaiser',
    displayName: 'Kaiser Permanente',
    primaryPayorId: 'KAISER',
    aliases: ['Kaiser', 'KP', 'Kaiser Foundation'],
    coverageTypes: ['medical'],
    transactionSupport: ELIGIBILITY_ONLY,
  },
  {
    stediId: 'magellan',
    displayName: 'Magellan Health',
    primaryPayorId: 'MAGELLAN',
    aliases: ['Magellan Behavioral Health'],
    coverageTypes: ['behavioral'],
    transactionSupport: CLAIMS_NO_ERA,
  },
  {
    stediId: 'optum',
    displayName: 'Optum / United Behavioral Health',
    primaryPayorId: 'OPTUM',
    aliases: ['UBH', 'Optum Behavioral', 'United Behavioral Health'],
    coverageTypes: ['behavioral'],
    transactionSupport: FULL,
  },
];

// ─── BCBS State Plans ─────────────────────────────────────────────────────────
const BCBS_CHILDREN = [
  { stediId: 'bcbs-al', displayName: 'BCBS of Alabama', primaryPayorId: 'BCBSAL', aliases: ['Blue Cross Blue Shield of Alabama', 'BCBS AL'] },
  { stediId: 'bcbs-az', displayName: 'BCBS of Arizona', primaryPayorId: 'BCBSAZ', aliases: ['Blue Cross Blue Shield of Arizona', 'BCBS AZ'] },
  { stediId: 'bcbs-ca', displayName: 'Blue Shield of California', primaryPayorId: 'BCBSCA', aliases: ['BSCA', 'Blue Shield CA', 'Blue Shield of CA'] },
  { stediId: 'bcbs-fl', displayName: 'Florida Blue (BCBS FL)', primaryPayorId: 'BCBSFL', aliases: ['Florida Blue', 'BCBS Florida', 'BCBS FL'] },
  { stediId: 'bcbs-ga', displayName: 'BCBS of Georgia', primaryPayorId: 'BCBSGA', aliases: ['Anthem BCBS Georgia', 'BCBS GA'] },
  { stediId: 'bcbs-il', displayName: 'BCBS of Illinois', primaryPayorId: 'BCBSIL', aliases: ['HCSC Illinois', 'Blue Cross Illinois', 'BCBS IL'] },
  { stediId: 'bcbs-ks', displayName: 'BCBS of Kansas', primaryPayorId: 'BCBSKS', aliases: ['Blue Cross Blue Shield of Kansas', 'BCBS KS'] },
  { stediId: 'bcbs-la', displayName: 'BCBS of Louisiana', primaryPayorId: 'BCBSLA', aliases: ['Blue Cross Blue Shield of Louisiana', 'BCBS LA'] },
  { stediId: 'bcbs-ma', displayName: 'BCBS of Massachusetts', primaryPayorId: 'BCBSMA', aliases: ['Blue Cross MA', 'BCBS MA'] },
  { stediId: 'bcbs-mi', displayName: 'BCBS of Michigan', primaryPayorId: 'BCBSMI', aliases: ['Blue Cross Michigan', 'BCBS MI'] },
  { stediId: 'bcbs-mn', displayName: 'BCBS of Minnesota', primaryPayorId: 'BCBSMN', aliases: ['Blue Cross MN', 'BCBS MN'] },
  { stediId: 'bcbs-ms', displayName: 'BCBS of Mississippi', primaryPayorId: 'BCBSMS', aliases: ['Blue Cross Blue Shield of Mississippi', 'BCBS MS'] },
  { stediId: 'bcbs-mt', displayName: 'BCBS of Montana', primaryPayorId: 'BCBSMT', aliases: ['Blue Cross Blue Shield of Montana', 'BCBS MT'] },
  { stediId: 'bcbs-nc', displayName: 'Blue Cross NC', primaryPayorId: 'BCBSNC', aliases: ['BCBS North Carolina', 'Blue Cross Blue Shield NC', 'BCBS NC'] },
  { stediId: 'bcbs-nd', displayName: 'BCBS of North Dakota', primaryPayorId: 'BCBSND', aliases: ['Noridian BCBS', 'BCBS ND'] },
  { stediId: 'bcbs-ne', displayName: 'BCBS of Nebraska', primaryPayorId: 'BCBSNE', aliases: ['Blue Cross Blue Shield of Nebraska', 'BCBS NE'] },
  { stediId: 'bcbs-nm', displayName: 'BCBS of New Mexico', primaryPayorId: 'BCBSNM', aliases: ['HCSC New Mexico', 'BCBS NM'] },
  { stediId: 'bcbs-ok', displayName: 'BCBS of Oklahoma', primaryPayorId: 'BCBSOK', aliases: ['HCSC Oklahoma', 'BCBS OK'] },
  { stediId: 'bcbs-ri', displayName: 'BCBS of Rhode Island', primaryPayorId: 'BCBSRI', aliases: ['Blue Cross RI', 'BCBS RI'] },
  { stediId: 'bcbs-sc', displayName: 'BlueCross BlueShield of South Carolina', primaryPayorId: 'BCBSSC', aliases: ['BCBS SC'] },
  { stediId: 'bcbs-tn', displayName: 'BlueCross BlueShield of Tennessee', primaryPayorId: 'BCBSTN', aliases: ['BCBS Tennessee', 'BCBS TN'] },
  { stediId: 'bcbs-tx', displayName: 'BCBS of Texas', primaryPayorId: 'BCBSTX', aliases: ['HCSC Texas', 'Blue Cross Blue Shield of Texas', 'BCBS TX'] },
  { stediId: 'bcbs-vt', displayName: 'BCBS of Vermont', primaryPayorId: 'BCBSVT', aliases: ['Blue Cross VT', 'BCBS VT'] },
  { stediId: 'bcbs-wy', displayName: 'BCBS of Wyoming', primaryPayorId: 'BCBSWY', aliases: ['Blue Cross Wyoming', 'BCBS WY'] },
];

// ─── Medicaid State Plans ─────────────────────────────────────────────────────
const MEDICAID_CHILDREN = [
  { stediId: 'medicaid-tx', displayName: 'Texas Medicaid (TMHP)', primaryPayorId: 'TXMEDICAID', aliases: ['TMHP', 'Texas Medicaid', 'TX Medicaid', 'Texas Health and Human Services'] },
  { stediId: 'medicaid-ca', displayName: 'California Medi-Cal', primaryPayorId: 'CAMEDICAID', aliases: ['Medi-Cal', 'DHCS California', 'CA Medicaid'] },
  { stediId: 'medicaid-fl', displayName: 'Florida Medicaid', primaryPayorId: 'FLMEDICAID', aliases: ['Florida AHCA Medicaid', 'FL Medicaid'] },
  { stediId: 'medicaid-ny', displayName: 'New York Medicaid', primaryPayorId: 'NYMEDICAID', aliases: ['NY Medicaid', 'eMedNY', 'New York State Medicaid'] },
  { stediId: 'medicaid-il', displayName: 'Illinois Medicaid (HFS)', primaryPayorId: 'ILMEDICAID', aliases: ['Illinois HFS', 'IL Medicaid', 'Illinois Department of Healthcare and Family Services'] },
  { stediId: 'medicaid-oh', displayName: 'Ohio Medicaid', primaryPayorId: 'OHMEDICAID', aliases: ['Ohio Department of Medicaid', 'OH Medicaid'] },
  { stediId: 'medicaid-pa', displayName: 'Pennsylvania Medicaid (MA)', primaryPayorId: 'PAMEDICAID', aliases: ['PA Medicaid', 'Pennsylvania Medical Assistance'] },
  { stediId: 'medicaid-ga', displayName: 'Georgia Medicaid', primaryPayorId: 'GAMEDICAID', aliases: ['GA Medicaid', 'Georgia DCH Medicaid'] },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Seeding MasterPayor records...\n');
  const now = Math.floor(Date.now() / 1000);

  // 1. Upsert top-level payors and capture their IDs
  const parentIdMap: Record<string, string> = {};

  for (const p of TOP_LEVEL) {
    const record = await prisma.masterPayor.upsert({
      where: { stediId: p.stediId },
      create: { ...p, parentId: null, isActive: true, createdAt: BigInt(now), updatedAt: BigInt(now) },
      update: { ...p, updatedAt: BigInt(now) },
    });
    parentIdMap[p.stediId] = record.id;
    console.log(`  ✓ ${p.displayName}`);
  }

  // 2. Upsert BCBS state plans under BCBS National
  const bcbsParentId = parentIdMap['bcbs-national'];
  if (bcbsParentId) {
    console.log('\n  BCBS State Plans:');
    for (const p of BCBS_CHILDREN) {
      await prisma.masterPayor.upsert({
        where: { stediId: p.stediId },
        create: {
          ...p,
          coverageTypes: ['medical'],
          transactionSupport: FULL,
          isActive: true,
          parentId: bcbsParentId,
          createdAt: BigInt(now),
          updatedAt: BigInt(now),
        },
        update: {
          ...p,
          coverageTypes: ['medical'],
          transactionSupport: FULL,
          parentId: bcbsParentId,
          updatedAt: BigInt(now),
        },
      });
      console.log(`    ↳ ${p.displayName}`);
    }
  }

  // 3. Upsert Medicaid state plans under Medicaid National
  const medicaidParentId = parentIdMap['medicaid-national'];
  if (medicaidParentId) {
    console.log('\n  Medicaid State Plans:');
    for (const p of MEDICAID_CHILDREN) {
      await prisma.masterPayor.upsert({
        where: { stediId: p.stediId },
        create: {
          ...p,
          coverageTypes: ['medical', 'behavioral'],
          transactionSupport: FULL,
          isActive: true,
          parentId: medicaidParentId,
          createdAt: BigInt(now),
          updatedAt: BigInt(now),
        },
        update: {
          ...p,
          coverageTypes: ['medical', 'behavioral'],
          transactionSupport: FULL,
          parentId: medicaidParentId,
          updatedAt: BigInt(now),
        },
      });
      console.log(`    ↳ ${p.displayName}`);
    }
  }

  const total = TOP_LEVEL.length + BCBS_CHILDREN.length + MEDICAID_CHILDREN.length;
  console.log(`\nDone! Seeded ${total} master payors (${TOP_LEVEL.length} top-level, ${BCBS_CHILDREN.length} BCBS state plans, ${MEDICAID_CHILDREN.length} Medicaid state plans).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
