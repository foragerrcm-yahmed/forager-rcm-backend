/**
 * Seed script for MasterPayor table.
 *
 * Sources the canonical list of US insurance payors with their Stedi IDs,
 * primary payor IDs, aliases, and transaction support flags.
 *
 * Run with: npx ts-node prisma/seed-master-payors.ts
 *
 * In production, this should be replaced by a nightly sync job that calls
 * GET https://healthcare.us.stedi.com/2024-04-01/payers and upserts records.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Top US insurance payors with Stedi IDs and common aliases.
// stediId values are Stedi's stable internal identifiers.
// primaryPayorId is the ID used in claim/eligibility submissions.
const MASTER_PAYORS = [
  {
    stediId: 'BCBSA',
    displayName: 'Blue Cross Blue Shield (National)',
    primaryPayorId: 'BCBSA',
    aliases: ['BCBS', 'BlueCross', 'BlueShield'],
    coverageTypes: ['medical', 'dental', 'vision'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'BCBSTX',
    displayName: 'Blue Cross Blue Shield of Texas',
    primaryPayorId: 'TXBCBS',
    aliases: ['TXBLS', 'BCBS Texas', 'BCBSTX', 'SB800'],
    coverageTypes: ['medical', 'dental', 'vision'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'AETNA',
    displayName: 'Aetna',
    primaryPayorId: '60054',
    aliases: ['Aetna Health', 'Aetna Life', 'AET'],
    coverageTypes: ['medical', 'dental', 'vision'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'CIGNA',
    displayName: 'Cigna',
    primaryPayorId: '62308',
    aliases: ['Cigna Health', 'Cigna Healthcare', 'CIGNA'],
    coverageTypes: ['medical', 'dental', 'vision'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'UHC',
    displayName: 'UnitedHealthcare',
    primaryPayorId: '87726',
    aliases: ['United Health', 'UHC', 'UnitedHealth', 'United Healthcare', 'UHG'],
    coverageTypes: ['medical', 'dental', 'vision'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'HUMANA',
    displayName: 'Humana',
    primaryPayorId: '61101',
    aliases: ['Humana Health', 'HUM'],
    coverageTypes: ['medical', 'dental', 'vision'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'ANTHEM',
    displayName: 'Anthem (Elevance Health)',
    primaryPayorId: 'ANTHEM',
    aliases: ['Anthem', 'Elevance', 'WellPoint', 'Empire BCBS'],
    coverageTypes: ['medical', 'dental'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'CVSHLT',
    displayName: 'CVS Health / Aetna',
    primaryPayorId: '60054',
    aliases: ['CVS Aetna', 'CVS Health', 'Aetna CVS'],
    coverageTypes: ['medical'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'MEDICARE',
    displayName: 'Medicare (CMS)',
    primaryPayorId: 'MEDICARE',
    aliases: ['CMS', 'Medicare Part B', 'Medicare Fee-for-Service', 'HCFA'],
    coverageTypes: ['medical'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'MEDICAID',
    displayName: 'Medicaid',
    primaryPayorId: 'MEDICAID',
    aliases: ['State Medicaid', 'Medicaid FFS'],
    coverageTypes: ['medical', 'dental'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'ENROLLMENT_REQUIRED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'TXMEDICAID',
    displayName: 'Texas Medicaid (TMHP)',
    primaryPayorId: 'TXMEDICAID',
    aliases: ['TMHP', 'Texas Medicaid', 'TX Medicaid'],
    coverageTypes: ['medical', 'dental'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'ENROLLMENT_REQUIRED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'TRICARE',
    displayName: 'TRICARE',
    primaryPayorId: 'TRICARE',
    aliases: ['Tricare', 'Military Health', 'CHAMPUS', 'Defense Health Agency'],
    coverageTypes: ['medical'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'OSCAR',
    displayName: 'Oscar Health',
    primaryPayorId: 'OSCAR',
    aliases: ['Oscar', 'Oscar Insurance'],
    coverageTypes: ['medical'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'MOLINA',
    displayName: 'Molina Healthcare',
    primaryPayorId: 'MOLINA',
    aliases: ['Molina', 'Molina Health'],
    coverageTypes: ['medical'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'ENROLLMENT_REQUIRED',
      claimStatus: 'SUPPORTED',
    },
  },
  {
    stediId: 'CENTENE',
    displayName: 'Centene / WellCare',
    primaryPayorId: 'CENTENE',
    aliases: ['Centene', 'WellCare', 'Ambetter', 'Health Net'],
    coverageTypes: ['medical'],
    transactionSupport: {
      eligibilityCheck: 'SUPPORTED',
      professionalClaimSubmission: 'SUPPORTED',
      claimPayment: 'SUPPORTED',
      claimStatus: 'SUPPORTED',
    },
  },
];

async function main() {
  console.log('Seeding MasterPayor table...');
  const now = Math.floor(Date.now() / 1000);

  for (const mp of MASTER_PAYORS) {
    await prisma.masterPayor.upsert({
      where: { stediId: mp.stediId },
      create: {
        stediId: mp.stediId,
        displayName: mp.displayName,
        primaryPayorId: mp.primaryPayorId,
        aliases: mp.aliases,
        coverageTypes: mp.coverageTypes,
        transactionSupport: mp.transactionSupport,
        isActive: true,
        createdAt: BigInt(now),
        updatedAt: BigInt(now),
      },
      update: {
        displayName: mp.displayName,
        primaryPayorId: mp.primaryPayorId,
        aliases: mp.aliases,
        coverageTypes: mp.coverageTypes,
        transactionSupport: mp.transactionSupport,
        isActive: true,
        updatedAt: BigInt(now),
      },
    });
    console.log(`  ✓ ${mp.displayName}`);
  }

  console.log(`\nSeeded ${MASTER_PAYORS.length} master payors.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
