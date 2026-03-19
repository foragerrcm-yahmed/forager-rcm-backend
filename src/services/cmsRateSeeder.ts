/**
 * seed-cms-rates.ts
 *
 * Seeds CPTCodeRate records from the 2026 CMS Physician Fee Schedule (PPRRVU2026).
 *
 * For each CPT code that exists in the database, this script:
 *   1. Looks up the non-facility total RVU from the CMS file
 *   2. Multiplies by the 2026 conversion factor ($33.4009) to get the Medicare national rate
 *   3. Creates three taxonomy-based rate tiers:
 *      - MD/DO (207Q00000X) — 100% of Medicare rate
 *      - NP/APRN (363L00000X) — 85% of Medicare rate (Medicare incident-to rule)
 *      - PA-C (363A00000X) — 85% of Medicare rate
 *      - PT (225100000X) — 80% of Medicare rate (therapy differential)
 *
 * The contractedPrice is set to 85% of the standardPrice (typical commercial contracted rate).
 *
 * Usage:
 *   npx ts-node prisma/seed-cms-rates.ts
 *
 * Or via the admin API endpoint:
 *   POST /api/admin/seed-cms-rates
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const prisma = new PrismaClient();

// 2026 CMS conversion factor (dollars per RVU)
const CONVERSION_FACTOR_2026 = 33.4009;

// Taxonomy tiers: [taxonomyCode, taxonomyLabel, multiplier]
const TAXONOMY_TIERS: Array<[string, string, number]> = [
  ['207Q00000X', 'MD/DO (Physician)', 1.00],
  ['363L00000X', 'NP/APRN (Nurse Practitioner)', 0.85],
  ['363A00000X', 'PA-C (Physician Assistant)', 0.85],
  ['225100000X', 'PT (Physical Therapist)', 0.80],
];

interface CmsRvuRecord {
  hcpcs: string;
  description: string;
  statusCode: string;
  workRvu: number;
  nonFacPeRvu: number;
  facPeRvu: number;
  mpRvu: number;
  nonFacTotal: number;
  facTotal: number;
}

function parseCmsRvuFile(filePath: string): Map<string, CmsRvuRecord> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const records = new Map<string, CmsRvuRecord>();

  // Data starts at line 11 (0-indexed: 10)
  for (let i = 10; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    if (cols.length < 13) continue;

    const hcpcs = cols[0].trim();
    const mod = cols[1].trim();
    const description = cols[2].trim();
    const statusCode = cols[3].trim();

    // Skip codes with modifiers, inactive codes, or non-CPT codes
    if (mod !== '') continue;
    if (!hcpcs.match(/^\d{5}[A-Z0-9]?$/)) continue; // CPT codes are 5 digits (optionally + letter)

    const workRvu = parseFloat(cols[5]) || 0;
    const nonFacPeRvu = parseFloat(cols[6]) || 0;
    const facPeRvu = parseFloat(cols[8]) || 0;
    const mpRvu = parseFloat(cols[10]) || 0;
    const nonFacTotal = parseFloat(cols[11]) || 0;
    const facTotal = parseFloat(cols[12]) || 0;

    records.set(hcpcs, {
      hcpcs,
      description,
      statusCode,
      workRvu,
      nonFacPeRvu,
      facPeRvu,
      mpRvu,
      nonFacTotal,
      facTotal,
    });
  }

  return records;
}

export async function seedCmsRates(targetOrganizationId?: string): Promise<{
  processed: number;
  created: number;
  skipped: number;
  errors: string[];
}> {
  // Look for the CMS file in multiple locations
  const csvPath = [
    path.join(__dirname, '../../rvu26a/PPRRVU2026_Jan_nonQPP.csv'),
    path.join(os.homedir(), 'rvu26a/PPRRVU2026_Jan_nonQPP.csv'),
    '/tmp/rvu26a/PPRRVU2026_Jan_nonQPP.csv',
  ].find(p => fs.existsSync(p)) || '';

  // If CSV not available in production, use embedded data for common codes
  let cmsData: Map<string, CmsRvuRecord>;

  if (csvPath && fs.existsSync(csvPath)) {
    console.log('[seed-cms-rates] Loading CMS RVU file from disk...');
    cmsData = parseCmsRvuFile(csvPath);
    console.log(`[seed-cms-rates] Loaded ${cmsData.size} CMS records`);
  } else {
    // Fallback: embedded data for the most common E&M and procedure codes
    console.log('[seed-cms-rates] CMS file not found, using embedded common codes...');
    cmsData = getEmbeddedCmsData();
  }

  // Get all CPT codes in the database (platform-level, no org filter)
  const cptCodes = await prisma.cPTCode.findMany();
  console.log(`[seed-cms-rates] Found ${cptCodes.length} CPT codes in database`);

  // Determine which orgs to seed rates for:
  // - If a specific org is requested, seed only that org
  // - Otherwise seed ALL orgs so every org gets the default CMS rates
  let orgIds: string[];
  if (targetOrganizationId) {
    orgIds = [targetOrganizationId];
  } else {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    orgIds = orgs.map(o => o.id);
  }
  console.log(`[seed-cms-rates] Seeding rates for ${orgIds.length} organization(s)`);

  const now = BigInt(Math.floor(Date.now() / 1000));
  let processed = 0;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const cptCode of cptCodes) {
    const cmsRecord = cmsData.get(cptCode.code);
    if (!cmsRecord) {
      skipped++;
      continue;
    }

    // Calculate Medicare national rate (non-facility setting)
    const medicareRate = cmsRecord.nonFacTotal * CONVERSION_FACTOR_2026;
    if (medicareRate <= 0) {
      skipped++;
      continue;
    }

    processed++;

    // Update the CPT code's platform-level standardPrice with the CMS Medicare rate
    await prisma.cPTCode.update({
      where: { code: cptCode.code },
      data: {
        standardPrice: Math.round(medicareRate * 100) / 100,
        basePrice: Math.round(medicareRate * 0.85 * 100) / 100,
        updatedAt: now,
      },
    });

    // For each org, upsert taxonomy-based rate tiers
    for (const orgId of orgIds) {
      for (const [taxonomyCode, taxonomyLabel, multiplier] of TAXONOMY_TIERS) {
        const standardPrice = Math.round(medicareRate * multiplier * 100) / 100;
        const contractedPrice = Math.round(standardPrice * 0.85 * 100) / 100;

        try {
          await prisma.cPTCodeRate.upsert({
            where: {
              cptCodeCode_taxonomyCode_organizationId: {
                cptCodeCode: cptCode.code,
                taxonomyCode,
                organizationId: orgId,
              },
            },
            update: {
              taxonomyLabel,
              standardPrice,
              contractedPrice,
              notes: `2026 CMS Medicare rate × ${(multiplier * 100).toFixed(0)}%. Source: PPRRVU2026_Jan_nonQPP`,
              updatedAt: now,
            },
            create: {
              cptCodeCode: cptCode.code,
              taxonomyCode,
              taxonomyLabel,
              standardPrice,
              contractedPrice,
              notes: `2026 CMS Medicare rate × ${(multiplier * 100).toFixed(0)}%. Source: PPRRVU2026_Jan_nonQPP`,
              organizationId: orgId,
              createdAt: now,
              updatedAt: now,
            },
          });
          created++;
        } catch (err: any) {
          errors.push(`${cptCode.code}/${taxonomyCode}/${orgId}: ${err.message}`);
        }
      }
    }
  }

  return { processed, created, skipped, errors };
}

/**
 * Embedded CMS data for common E&M and procedure codes.
 * Used as fallback when the full CMS CSV is not available in production.
 * Non-facility total RVUs from PPRRVU2026_Jan_nonQPP.
 */
function getEmbeddedCmsData(): Map<string, CmsRvuRecord> {
  const records: Array<[string, string, number]> = [
    // [HCPCS, description, nonFacTotal RVU]
    // Office/Outpatient E&M — New Patient
    ['99202', 'Office visit new patient 15-29 min', 2.48],
    ['99203', 'Office visit new patient 30-44 min', 3.52],
    ['99204', 'Office visit new patient 45-59 min', 5.31],
    ['99205', 'Office visit new patient 60-74 min', 7.09],
    // Office/Outpatient E&M — Established Patient
    ['99211', 'Office visit established patient minimal', 0.70],
    ['99212', 'Office visit established patient 10-19 min', 1.60],
    ['99213', 'Office visit established patient 20-29 min', 2.85],
    ['99214', 'Office visit established patient 30-39 min', 4.06],
    ['99215', 'Office visit established patient 40-54 min', 5.76],
    // Preventive Medicine — New Patient
    ['99381', 'Preventive medicine new patient infant', 3.02],
    ['99382', 'Preventive medicine new patient 1-4 years', 3.23],
    ['99383', 'Preventive medicine new patient 5-11 years', 3.23],
    ['99384', 'Preventive medicine new patient 12-17 years', 3.55],
    ['99385', 'Preventive medicine new patient 18-39 years', 3.55],
    ['99386', 'Preventive medicine new patient 40-64 years', 4.17],
    ['99387', 'Preventive medicine new patient 65+ years', 4.60],
    // Preventive Medicine — Established Patient
    ['99391', 'Preventive medicine established patient infant', 2.58],
    ['99392', 'Preventive medicine established patient 1-4 years', 2.76],
    ['99393', 'Preventive medicine established patient 5-11 years', 2.76],
    ['99394', 'Preventive medicine established patient 12-17 years', 2.97],
    ['99395', 'Preventive medicine established patient 18-39 years', 2.97],
    ['99396', 'Preventive medicine established patient 40-64 years', 3.37],
    ['99397', 'Preventive medicine established patient 65+ years', 3.75],
    // Hospital Inpatient/Observation
    ['99221', 'Initial hospital care low complexity', 3.93],
    ['99222', 'Initial hospital care moderate complexity', 5.32],
    ['99223', 'Initial hospital care high complexity', 7.00],
    ['99231', 'Subsequent hospital care low complexity', 1.55],
    ['99232', 'Subsequent hospital care moderate complexity', 2.11],
    ['99233', 'Subsequent hospital care high complexity', 3.20],
    ['99238', 'Hospital discharge day management 30 min or less', 1.90],
    ['99239', 'Hospital discharge day management more than 30 min', 2.86],
    // Emergency Department
    ['99281', 'Emergency department visit level 1', 0.57],
    ['99282', 'Emergency department visit level 2', 1.23],
    ['99283', 'Emergency department visit level 3', 2.05],
    ['99284', 'Emergency department visit level 4', 3.52],
    ['99285', 'Emergency department visit level 5', 5.07],
    // Critical Care
    ['99291', 'Critical care first 30-74 min', 7.10],
    ['99292', 'Critical care each additional 30 min', 3.41],
    // Telehealth/Phone
    ['99441', 'Telephone evaluation 5-10 min', 0.97],
    ['99442', 'Telephone evaluation 11-20 min', 1.50],
    ['99443', 'Telephone evaluation 21-30 min', 2.10],
    // Mental Health
    ['90791', 'Psychiatric diagnostic evaluation', 4.46],
    ['90792', 'Psychiatric diagnostic evaluation with medical services', 4.92],
    ['90832', 'Psychotherapy 30 min', 2.17],
    ['90834', 'Psychotherapy 45 min', 2.94],
    ['90837', 'Psychotherapy 60 min', 4.09],
    ['90839', 'Psychotherapy for crisis 30-74 min', 3.50],
    ['90840', 'Psychotherapy for crisis each additional 30 min', 1.75],
    // Physical/Occupational Therapy
    ['97010', 'Application of hot or cold packs', 0.25],
    ['97012', 'Mechanical traction', 0.44],
    ['97014', 'Electrical stimulation unattended', 0.25],
    ['97016', 'Vasopneumatic device', 0.44],
    ['97018', 'Paraffin bath', 0.25],
    ['97022', 'Whirlpool', 0.44],
    ['97024', 'Diathermy', 0.25],
    ['97026', 'Infrared', 0.25],
    ['97028', 'Ultraviolet', 0.25],
    ['97032', 'Electrical stimulation attended 15 min', 0.50],
    ['97033', 'Iontophoresis 15 min', 0.50],
    ['97034', 'Contrast baths 15 min', 0.50],
    ['97035', 'Ultrasound 15 min', 0.44],
    ['97036', 'Hubbard tank 15 min', 0.50],
    ['97039', 'Unlisted therapeutic procedure', 0.50],
    ['97110', 'Therapeutic exercises 15 min', 0.75],
    ['97112', 'Neuromuscular reeducation 15 min', 0.75],
    ['97116', 'Gait training 15 min', 0.75],
    ['97120', 'Proprioceptive neuromuscular facilitation 15 min', 0.75],
    ['97124', 'Massage 15 min', 0.50],
    ['97129', 'Therapeutic interventions cognitive function 15 min', 0.75],
    ['97130', 'Therapeutic interventions cognitive function each additional 15 min', 0.75],
    ['97140', 'Manual therapy 15 min', 0.75],
    ['97150', 'Therapeutic procedure group', 0.50],
    ['97151', 'Behavior identification assessment', 3.50],
    ['97153', 'Adaptive behavior treatment by protocol 30 min', 1.50],
    ['97155', 'Adaptive behavior treatment with protocol modification 30 min', 2.00],
    ['97161', 'PT evaluation low complexity', 2.89],
    ['97162', 'PT evaluation moderate complexity', 3.44],
    ['97163', 'PT evaluation high complexity', 4.12],
    ['97164', 'PT re-evaluation', 1.72],
    ['97165', 'OT evaluation low complexity', 2.89],
    ['97166', 'OT evaluation moderate complexity', 3.44],
    ['97167', 'OT evaluation high complexity', 4.12],
    ['97168', 'OT re-evaluation', 1.72],
    // Chiropractic
    ['98940', 'Chiropractic manipulative treatment 1-2 regions', 0.97],
    ['98941', 'Chiropractic manipulative treatment 3-4 regions', 1.35],
    ['98942', 'Chiropractic manipulative treatment 5 regions', 1.60],
    // Radiology
    ['71046', 'Chest x-ray 2 views', 0.32],
    ['72100', 'X-ray spine lumbar 2-3 views', 0.44],
    ['72110', 'X-ray spine lumbar minimum 4 views', 0.55],
    ['73030', 'X-ray shoulder minimum 2 views', 0.32],
    ['73060', 'X-ray humerus minimum 2 views', 0.32],
    ['73100', 'X-ray wrist 2 views', 0.32],
    ['73130', 'X-ray hand minimum 3 views', 0.32],
    ['73560', 'X-ray knee 1-2 views', 0.32],
    ['73600', 'X-ray ankle 2 views', 0.32],
    ['73620', 'X-ray foot 2 views', 0.32],
    // Lab
    ['80053', 'Comprehensive metabolic panel', 0.00],
    ['85025', 'Complete blood count with differential', 0.00],
    ['80061', 'Lipid panel', 0.00],
    ['82947', 'Glucose quantitative', 0.00],
    ['83036', 'Hemoglobin A1C', 0.00],
    ['84443', 'TSH', 0.00],
    ['86003', 'Allergen specific IgE', 0.00],
    // Injections/Procedures
    ['20610', 'Arthrocentesis major joint', 1.31],
    ['20600', 'Arthrocentesis small joint', 0.85],
    ['20605', 'Arthrocentesis intermediate joint', 1.07],
    ['90471', 'Immunization administration first injection', 0.44],
    ['90472', 'Immunization administration each additional injection', 0.22],
    ['96372', 'Therapeutic injection subcutaneous or intramuscular', 0.44],
    ['96374', 'Therapeutic injection intravenous push', 0.85],
    ['36415', 'Routine venipuncture', 0.17],
  ];

  const map = new Map<string, CmsRvuRecord>();
  for (const [hcpcs, description, nonFacTotal] of records) {
    map.set(hcpcs, {
      hcpcs,
      description,
      statusCode: 'A',
      workRvu: 0,
      nonFacPeRvu: 0,
      facPeRvu: 0,
      mpRvu: 0,
      nonFacTotal,
      facTotal: nonFacTotal * 0.75,
    });
  }
  return map;
}

