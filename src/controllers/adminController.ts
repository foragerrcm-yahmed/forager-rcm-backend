import { Request, Response } from 'express';
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

const TOP_LEVEL = [
  { stediId: 'bcbs-national', displayName: 'Blue Cross Blue Shield (National)', primaryPayorId: 'BCBS', aliases: ['Blue Cross', 'Blue Shield', 'BCBS', 'BCBSA'], coverageTypes: ['medical', 'dental', 'vision'], transactionSupport: ELIGIBILITY_ONLY },
  { stediId: 'aetna', displayName: 'Aetna', primaryPayorId: '60054', aliases: ['Aetna Health', 'CVS Aetna', 'AET'], coverageTypes: ['medical', 'dental', 'vision', 'behavioral'], transactionSupport: FULL },
  { stediId: 'cigna', displayName: 'Cigna', primaryPayorId: '62308', aliases: ['Cigna Health', 'Cigna Healthcare', 'CI'], coverageTypes: ['medical', 'dental', 'vision', 'behavioral'], transactionSupport: FULL },
  { stediId: 'unitedhealthcare', displayName: 'UnitedHealthcare', primaryPayorId: '87726', aliases: ['UHC', 'United Health', 'United Healthcare', 'Optum'], coverageTypes: ['medical', 'dental', 'vision', 'behavioral'], transactionSupport: FULL },
  { stediId: 'humana', displayName: 'Humana', primaryPayorId: '61101', aliases: ['Humana Health', 'HUM'], coverageTypes: ['medical', 'dental', 'vision'], transactionSupport: FULL },
  { stediId: 'anthem', displayName: 'Anthem', primaryPayorId: 'ANTHEM', aliases: ['Anthem Blue Cross', 'Anthem BCBS', 'Elevance Health'], coverageTypes: ['medical', 'dental', 'vision'], transactionSupport: FULL },
  { stediId: 'medicare', displayName: 'Medicare', primaryPayorId: 'MEDICARE', aliases: ['CMS', 'Centers for Medicare', 'Part A', 'Part B'], coverageTypes: ['medical'], transactionSupport: FULL },
  { stediId: 'medicaid-national', displayName: 'Medicaid (National)', primaryPayorId: 'MEDICAID', aliases: ['Medicaid', 'State Medicaid'], coverageTypes: ['medical', 'behavioral'], transactionSupport: ELIGIBILITY_ONLY },
  { stediId: 'tricare', displayName: 'TRICARE', primaryPayorId: 'TRICARE', aliases: ['Defense Health Agency', 'DHA', 'Military Health'], coverageTypes: ['medical', 'dental'], transactionSupport: FULL },
  { stediId: 'oscar-health', displayName: 'Oscar Health', primaryPayorId: 'OSCAR', aliases: ['Oscar', 'Oscar Insurance'], coverageTypes: ['medical'], transactionSupport: CLAIMS_NO_ERA },
  { stediId: 'molina-healthcare', displayName: 'Molina Healthcare', primaryPayorId: 'MOLINA', aliases: ['Molina', 'Molina Health'], coverageTypes: ['medical', 'behavioral'], transactionSupport: FULL },
  { stediId: 'centene', displayName: 'Centene Corporation', primaryPayorId: 'CENTENE', aliases: ['Centene', 'WellCare', 'Ambetter', 'Health Net'], coverageTypes: ['medical', 'behavioral'], transactionSupport: FULL },
  { stediId: 'kaiser-permanente', displayName: 'Kaiser Permanente', primaryPayorId: 'KAISER', aliases: ['Kaiser', 'KP', 'Kaiser Foundation'], coverageTypes: ['medical', 'dental', 'vision'], transactionSupport: CLAIMS_NO_ERA },
  { stediId: 'magellan-health', displayName: 'Magellan Health', primaryPayorId: 'MAGELLAN', aliases: ['Magellan', 'Magellan Behavioral'], coverageTypes: ['behavioral'], transactionSupport: FULL },
  { stediId: 'optum', displayName: 'Optum', primaryPayorId: 'OPTUM', aliases: ['OptumRx', 'OptumHealth', 'UHC Optum'], coverageTypes: ['medical', 'behavioral'], transactionSupport: FULL },
];

const BCBS_CHILDREN = [
  { stediId: 'bcbs-al', displayName: 'BCBS of Alabama', primaryPayorId: 'BCBSAL', aliases: ['Blue Cross Blue Shield of Alabama'] },
  { stediId: 'bcbs-az', displayName: 'BCBS of Arizona', primaryPayorId: 'BCBSAZ', aliases: ['Blue Cross Blue Shield of Arizona'] },
  { stediId: 'bcbs-ca', displayName: 'Blue Shield of California', primaryPayorId: 'BCBSCA', aliases: ['Blue Shield CA', 'BSCA'] },
  { stediId: 'bcbs-fl', displayName: 'Florida Blue (BCBS of Florida)', primaryPayorId: 'BCBSFL', aliases: ['Florida Blue', 'Blue Cross Blue Shield of Florida'] },
  { stediId: 'bcbs-ga', displayName: 'Anthem BCBS of Georgia', primaryPayorId: 'BCBSGA', aliases: ['Blue Cross Blue Shield of Georgia'] },
  { stediId: 'bcbs-il', displayName: 'HCSC - BCBS of Illinois', primaryPayorId: 'BCBSIL', aliases: ['Blue Cross Blue Shield of Illinois', 'HCSC Illinois'] },
  { stediId: 'bcbs-ks', displayName: 'BCBS of Kansas', primaryPayorId: 'BCBSKS', aliases: ['Blue Cross Blue Shield of Kansas'] },
  { stediId: 'bcbs-la', displayName: 'BCBS of Louisiana', primaryPayorId: 'BCBSLA', aliases: ['Blue Cross Blue Shield of Louisiana'] },
  { stediId: 'bcbs-ma', displayName: 'Blue Cross Blue Shield of Massachusetts', primaryPayorId: 'BCBSMA', aliases: ['BCBS MA', 'Blue Cross MA'] },
  { stediId: 'bcbs-mi', displayName: 'Blue Cross Blue Shield of Michigan', primaryPayorId: 'BCBSMI', aliases: ['BCBS Michigan', 'Blue Cross Michigan'] },
  { stediId: 'bcbs-mn', displayName: 'Blue Cross Blue Shield of Minnesota', primaryPayorId: 'BCBSMN', aliases: ['BCBS Minnesota'] },
  { stediId: 'bcbs-ms', displayName: 'BCBS of Mississippi', primaryPayorId: 'BCBSMS', aliases: ['Blue Cross Blue Shield of Mississippi'] },
  { stediId: 'bcbs-mt', displayName: 'BCBS of Montana', primaryPayorId: 'BCBSMT', aliases: ['Blue Cross Blue Shield of Montana'] },
  { stediId: 'bcbs-nc', displayName: 'Blue Cross NC', primaryPayorId: 'BCBSNC', aliases: ['Blue Cross Blue Shield of North Carolina', 'BCBS NC'] },
  { stediId: 'bcbs-nd', displayName: 'BCBS of North Dakota', primaryPayorId: 'BCBSND', aliases: ['Blue Cross Blue Shield of North Dakota', 'Noridian'] },
  { stediId: 'bcbs-ne', displayName: 'Blue Cross Blue Shield of Nebraska', primaryPayorId: 'BCBSNE', aliases: ['BCBS Nebraska'] },
  { stediId: 'bcbs-nm', displayName: 'BCBS of New Mexico', primaryPayorId: 'BCBSNM', aliases: ['Blue Cross Blue Shield of New Mexico', 'HCSC New Mexico'] },
  { stediId: 'bcbs-ok', displayName: 'BCBS of Oklahoma', primaryPayorId: 'BCBSOK', aliases: ['Blue Cross Blue Shield of Oklahoma', 'HCSC Oklahoma'] },
  { stediId: 'bcbs-ri', displayName: 'BCBS of Rhode Island', primaryPayorId: 'BCBSRI', aliases: ['Blue Cross Blue Shield of Rhode Island'] },
  { stediId: 'bcbs-sc', displayName: 'BlueCross BlueShield of South Carolina', primaryPayorId: 'BCBSSC', aliases: ['BCBS South Carolina'] },
  { stediId: 'bcbs-tn', displayName: 'BlueCross BlueShield of Tennessee', primaryPayorId: 'BCBSTN', aliases: ['BCBS Tennessee'] },
  { stediId: 'bcbs-tx', displayName: 'BCBS of Texas', primaryPayorId: 'BCBSTX', aliases: ['Blue Cross Blue Shield of Texas', 'HCSC Texas'] },
  { stediId: 'bcbs-vt', displayName: 'Blue Cross Blue Shield of Vermont', primaryPayorId: 'BCBSVT', aliases: ['BCBS Vermont'] },
  { stediId: 'bcbs-wy', displayName: 'BCBS of Wyoming', primaryPayorId: 'BCBSWY', aliases: ['Blue Cross Blue Shield of Wyoming'] },
];

const MEDICAID_CHILDREN = [
  { stediId: 'medicaid-tx', displayName: 'Texas Medicaid (TMHP)', primaryPayorId: 'TXMEDICAID', aliases: ['TMHP', 'Texas Medicaid & Healthcare Partnership'] },
  { stediId: 'medicaid-ca', displayName: 'California Medi-Cal', primaryPayorId: 'CAMEDICAID', aliases: ['Medi-Cal', 'DHCS California'] },
  { stediId: 'medicaid-fl', displayName: 'Florida Medicaid', primaryPayorId: 'FLMEDICAID', aliases: ['AHCA Florida', 'Florida Agency for Health Care Administration'] },
  { stediId: 'medicaid-ny', displayName: 'New York Medicaid (eMedNY)', primaryPayorId: 'NYMEDICAID', aliases: ['eMedNY', 'NY Medicaid'] },
  { stediId: 'medicaid-il', displayName: 'Illinois Medicaid (HFS)', primaryPayorId: 'ILMEDICAID', aliases: ['HFS Illinois', 'Illinois Department of Healthcare and Family Services'] },
  { stediId: 'medicaid-oh', displayName: 'Ohio Medicaid', primaryPayorId: 'OHMEDICAID', aliases: ['Ohio Department of Medicaid', 'ODM'] },
  { stediId: 'medicaid-pa', displayName: 'Pennsylvania Medicaid (PROMISe)', primaryPayorId: 'PAMEDICAID', aliases: ['PROMISe', 'PA DHS Medicaid'] },
  { stediId: 'medicaid-ga', displayName: 'Georgia Medicaid (GAMMIS)', primaryPayorId: 'GAMEDICAID', aliases: ['GAMMIS', 'Georgia Department of Community Health'] },
];

/**
 * POST /api/admin/seed-master-payors
 * Protected by ADMIN_SEED_SECRET header.
 * Safe to call multiple times — uses upsert logic.
 */
export const seedMasterPayors = async (req: Request, res: Response): Promise<void> => {
  const secret = req.headers['x-admin-seed-secret'];
  const expectedSecret = process.env.ADMIN_SEED_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const parentIdMap: Record<string, string> = {};
    const results: string[] = [];

    // 1. Upsert top-level payors
    for (const p of TOP_LEVEL) {
      const record = await prisma.masterPayor.upsert({
        where: { stediId: p.stediId },
        create: {
          ...p,
          isActive: true,
          createdAt: BigInt(now),
          updatedAt: BigInt(now),
        },
        update: {
          ...p,
          updatedAt: BigInt(now),
        },
      });
      parentIdMap[p.stediId] = record.id;
      results.push(record.displayName);
    }

    // 2. Upsert BCBS state plans under BCBS National
    const bcbsParentId = parentIdMap['bcbs-national'];
    if (bcbsParentId) {
      for (const p of BCBS_CHILDREN) {
        const record = await prisma.masterPayor.upsert({
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
        results.push(`  ↳ ${record.displayName}`);
      }
    }

    // 3. Upsert Medicaid state plans under Medicaid National
    const medicaidParentId = parentIdMap['medicaid-national'];
    if (medicaidParentId) {
      for (const p of MEDICAID_CHILDREN) {
        const record = await prisma.masterPayor.upsert({
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
        results.push(`  ↳ ${record.displayName}`);
      }
    }

    const total = TOP_LEVEL.length + BCBS_CHILDREN.length + MEDICAID_CHILDREN.length;
    res.status(200).json({
      success: true,
      message: `Seeded ${total} master payors (${TOP_LEVEL.length} top-level, ${BCBS_CHILDREN.length} BCBS state plans, ${MEDICAID_CHILDREN.length} Medicaid state plans)`,
      payors: results,
    });
  } catch (error: any) {
    console.error('[admin] seed-master-payors error:', error);
    res.status(500).json({ error: 'Seed failed', detail: error?.message });
  }
};
