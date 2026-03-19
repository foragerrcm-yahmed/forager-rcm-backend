"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedIcd10Codes = seedIcd10Codes;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Curated ICD-10-CM codes commonly used in behavioral health, PT/rehab, primary care, and orthopedics
const COMMON_ICD10_CODES = [
    // ─── Mental Health / Behavioral Health ───
    { code: 'F32.0', description: 'Major depressive disorder, single episode, mild', category: 'Mental Health' },
    { code: 'F32.1', description: 'Major depressive disorder, single episode, moderate', category: 'Mental Health' },
    { code: 'F32.2', description: 'Major depressive disorder, single episode, severe without psychotic features', category: 'Mental Health' },
    { code: 'F32.3', description: 'Major depressive disorder, single episode, severe with psychotic features', category: 'Mental Health' },
    { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Mental Health' },
    { code: 'F33.0', description: 'Major depressive disorder, recurrent, mild', category: 'Mental Health' },
    { code: 'F33.1', description: 'Major depressive disorder, recurrent, moderate', category: 'Mental Health' },
    { code: 'F33.2', description: 'Major depressive disorder, recurrent severe without psychotic features', category: 'Mental Health' },
    { code: 'F33.9', description: 'Major depressive disorder, recurrent, unspecified', category: 'Mental Health' },
    { code: 'F41.0', description: 'Panic disorder without agoraphobia', category: 'Mental Health' },
    { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Mental Health' },
    { code: 'F41.9', description: 'Anxiety disorder, unspecified', category: 'Mental Health' },
    { code: 'F40.10', description: 'Social phobia, unspecified', category: 'Mental Health' },
    { code: 'F42.2', description: 'Mixed obsessional thoughts and acts', category: 'Mental Health' },
    { code: 'F42.9', description: 'Obsessive-compulsive disorder, unspecified', category: 'Mental Health' },
    { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified', category: 'Mental Health' },
    { code: 'F43.11', description: 'Post-traumatic stress disorder, acute', category: 'Mental Health' },
    { code: 'F43.12', description: 'Post-traumatic stress disorder, chronic', category: 'Mental Health' },
    { code: 'F43.20', description: 'Adjustment disorder, unspecified', category: 'Mental Health' },
    { code: 'F43.21', description: 'Adjustment disorder with depressed mood', category: 'Mental Health' },
    { code: 'F43.22', description: 'Adjustment disorder with anxiety', category: 'Mental Health' },
    { code: 'F43.23', description: 'Adjustment disorder with mixed anxiety and depressed mood', category: 'Mental Health' },
    { code: 'F31.9', description: 'Bipolar disorder, unspecified', category: 'Mental Health' },
    { code: 'F31.0', description: 'Bipolar disorder, current episode hypomanic', category: 'Mental Health' },
    { code: 'F31.30', description: 'Bipolar disorder, current episode depressed, mild or moderate severity, unspecified', category: 'Mental Health' },
    { code: 'F20.9', description: 'Schizophrenia, unspecified', category: 'Mental Health' },
    { code: 'F25.9', description: 'Schizoaffective disorder, unspecified', category: 'Mental Health' },
    { code: 'F60.3', description: 'Borderline personality disorder', category: 'Mental Health' },
    { code: 'F60.9', description: 'Personality disorder, unspecified', category: 'Mental Health' },
    { code: 'F90.0', description: 'Attention-deficit hyperactivity disorder, predominantly inattentive type', category: 'Mental Health' },
    { code: 'F90.1', description: 'Attention-deficit hyperactivity disorder, predominantly hyperactive type', category: 'Mental Health' },
    { code: 'F90.2', description: 'Attention-deficit hyperactivity disorder, combined type', category: 'Mental Health' },
    { code: 'F90.9', description: 'Attention-deficit hyperactivity disorder, unspecified type', category: 'Mental Health' },
    { code: 'F84.0', description: 'Autistic disorder', category: 'Mental Health' },
    { code: 'F84.5', description: "Asperger's syndrome", category: 'Mental Health' },
    { code: 'F50.00', description: 'Anorexia nervosa, unspecified', category: 'Mental Health' },
    { code: 'F50.2', description: 'Bulimia nervosa', category: 'Mental Health' },
    { code: 'F51.01', description: 'Primary insomnia', category: 'Mental Health' },
    { code: 'F10.20', description: 'Alcohol use disorder, moderate', category: 'Mental Health' },
    { code: 'F10.10', description: 'Alcohol abuse, uncomplicated', category: 'Mental Health' },
    { code: 'F11.20', description: 'Opioid dependence, uncomplicated', category: 'Mental Health' },
    { code: 'F12.20', description: 'Cannabis dependence, uncomplicated', category: 'Mental Health' },
    { code: 'F19.20', description: 'Other psychoactive substance dependence, uncomplicated', category: 'Mental Health' },
    // ─── Musculoskeletal / Orthopedics ───
    { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal' },
    { code: 'M54.50', description: 'Low back pain, unspecified', category: 'Musculoskeletal' },
    { code: 'M54.51', description: 'Vertebrogenic low back pain', category: 'Musculoskeletal' },
    { code: 'M54.59', description: 'Other low back pain', category: 'Musculoskeletal' },
    { code: 'M54.2', description: 'Cervicalgia', category: 'Musculoskeletal' },
    { code: 'M54.4', description: 'Lumbago with sciatica, unspecified side', category: 'Musculoskeletal' },
    { code: 'M54.41', description: 'Lumbago with sciatica, right side', category: 'Musculoskeletal' },
    { code: 'M54.42', description: 'Lumbago with sciatica, left side', category: 'Musculoskeletal' },
    { code: 'M54.3', description: 'Sciatica, unspecified side', category: 'Musculoskeletal' },
    { code: 'M25.511', description: 'Pain in right shoulder', category: 'Musculoskeletal' },
    { code: 'M25.512', description: 'Pain in left shoulder', category: 'Musculoskeletal' },
    { code: 'M25.561', description: 'Pain in right knee', category: 'Musculoskeletal' },
    { code: 'M25.562', description: 'Pain in left knee', category: 'Musculoskeletal' },
    { code: 'M25.571', description: 'Pain in right ankle and joints of right foot', category: 'Musculoskeletal' },
    { code: 'M25.572', description: 'Pain in left ankle and joints of left foot', category: 'Musculoskeletal' },
    { code: 'M75.1', description: 'Rotator cuff syndrome', category: 'Musculoskeletal' },
    { code: 'M75.100', description: 'Unspecified rotator cuff syndrome of unspecified shoulder', category: 'Musculoskeletal' },
    { code: 'M75.101', description: 'Unspecified rotator cuff syndrome of right shoulder', category: 'Musculoskeletal' },
    { code: 'M75.102', description: 'Unspecified rotator cuff syndrome of left shoulder', category: 'Musculoskeletal' },
    { code: 'M79.3', description: 'Panniculitis, unspecified', category: 'Musculoskeletal' },
    { code: 'M79.7', description: 'Fibromyalgia', category: 'Musculoskeletal' },
    { code: 'M47.816', description: 'Spondylosis without myelopathy or radiculopathy, lumbar region', category: 'Musculoskeletal' },
    { code: 'M47.812', description: 'Spondylosis without myelopathy or radiculopathy, cervical region', category: 'Musculoskeletal' },
    { code: 'M51.16', description: 'Intervertebral disc degeneration, lumbar region', category: 'Musculoskeletal' },
    { code: 'M51.17', description: 'Intervertebral disc degeneration, lumbosacral region', category: 'Musculoskeletal' },
    { code: 'M50.20', description: 'Other cervical disc displacement, unspecified cervical region', category: 'Musculoskeletal' },
    { code: 'M17.11', description: 'Primary osteoarthritis, right knee', category: 'Musculoskeletal' },
    { code: 'M17.12', description: 'Primary osteoarthritis, left knee', category: 'Musculoskeletal' },
    { code: 'M16.11', description: 'Unilateral primary osteoarthritis, right hip', category: 'Musculoskeletal' },
    { code: 'M16.12', description: 'Unilateral primary osteoarthritis, left hip', category: 'Musculoskeletal' },
    { code: 'M65.311', description: 'Trigger finger, right index finger', category: 'Musculoskeletal' },
    { code: 'M77.31', description: 'Calcaneal spur, right foot', category: 'Musculoskeletal' },
    { code: 'M77.32', description: 'Calcaneal spur, left foot', category: 'Musculoskeletal' },
    { code: 'M77.11', description: 'Lateral epicondylitis, right elbow', category: 'Musculoskeletal' },
    { code: 'M77.12', description: 'Lateral epicondylitis, left elbow', category: 'Musculoskeletal' },
    // ─── Neurological ───
    { code: 'G43.909', description: 'Migraine, unspecified, not intractable, without status migrainosus', category: 'Neurological' },
    { code: 'G43.001', description: 'Migraine without aura, not intractable, with status migrainosus', category: 'Neurological' },
    { code: 'G44.309', description: 'Post-traumatic headache, unspecified, not intractable', category: 'Neurological' },
    { code: 'G54.2', description: 'Cervical root disorders, not elsewhere classified', category: 'Neurological' },
    { code: 'G54.4', description: 'Lumbosacral root disorders, not elsewhere classified', category: 'Neurological' },
    { code: 'G57.00', description: 'Lesion of sciatic nerve, unspecified lower limb', category: 'Neurological' },
    { code: 'G57.01', description: 'Lesion of sciatic nerve, right lower limb', category: 'Neurological' },
    { code: 'G57.02', description: 'Lesion of sciatic nerve, left lower limb', category: 'Neurological' },
    { code: 'G56.00', description: 'Carpal tunnel syndrome, unspecified upper limb', category: 'Neurological' },
    { code: 'G56.01', description: 'Carpal tunnel syndrome, right upper limb', category: 'Neurological' },
    { code: 'G56.02', description: 'Carpal tunnel syndrome, left upper limb', category: 'Neurological' },
    { code: 'G35', description: 'Multiple sclerosis', category: 'Neurological' },
    { code: 'G20', description: "Parkinson's disease", category: 'Neurological' },
    { code: 'G30.9', description: "Alzheimer's disease, unspecified", category: 'Neurological' },
    { code: 'G40.909', description: 'Epilepsy, unspecified, not intractable, without status epilepticus', category: 'Neurological' },
    { code: 'G89.29', description: 'Other chronic pain', category: 'Neurological' },
    { code: 'G89.4', description: 'Chronic pain syndrome', category: 'Neurological' },
    // ─── Cardiovascular ───
    { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular' },
    { code: 'I25.10', description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris', category: 'Cardiovascular' },
    { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular' },
    { code: 'I48.91', description: 'Unspecified atrial fibrillation', category: 'Cardiovascular' },
    { code: 'I63.9', description: 'Cerebral infarction, unspecified', category: 'Cardiovascular' },
    { code: 'I69.351', description: 'Hemiplegia and hemiparesis following cerebral infarction affecting right dominant side', category: 'Cardiovascular' },
    { code: 'I69.352', description: 'Hemiplegia and hemiparesis following cerebral infarction affecting left non-dominant side', category: 'Cardiovascular' },
    // ─── Endocrine / Metabolic ───
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
    { code: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', category: 'Endocrine' },
    { code: 'E11.40', description: 'Type 2 diabetes mellitus with diabetic neuropathy, unspecified', category: 'Endocrine' },
    { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', category: 'Endocrine' },
    { code: 'E03.9', description: 'Hypothyroidism, unspecified', category: 'Endocrine' },
    { code: 'E05.90', description: 'Thyrotoxicosis, unspecified, without thyrotoxic crisis or storm', category: 'Endocrine' },
    { code: 'E66.9', description: 'Obesity, unspecified', category: 'Endocrine' },
    { code: 'E66.01', description: 'Morbid (severe) obesity due to excess calories', category: 'Endocrine' },
    { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Endocrine' },
    { code: 'E78.00', description: 'Pure hypercholesterolemia, unspecified', category: 'Endocrine' },
    // ─── Respiratory ───
    { code: 'J45.20', description: 'Mild intermittent asthma, uncomplicated', category: 'Respiratory' },
    { code: 'J45.40', description: 'Moderate persistent asthma, uncomplicated', category: 'Respiratory' },
    { code: 'J44.1', description: 'Chronic obstructive pulmonary disease with (acute) exacerbation', category: 'Respiratory' },
    { code: 'J44.0', description: 'Chronic obstructive pulmonary disease with acute lower respiratory infection', category: 'Respiratory' },
    { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory' },
    { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Respiratory' },
    // ─── Gastrointestinal ───
    { code: 'K21.0', description: 'Gastro-esophageal reflux disease with esophagitis', category: 'Gastrointestinal' },
    { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis', category: 'Gastrointestinal' },
    { code: 'K58.9', description: 'Irritable bowel syndrome without diarrhea', category: 'Gastrointestinal' },
    { code: 'K57.30', description: 'Diverticulosis of large intestine without perforation or abscess without bleeding', category: 'Gastrointestinal' },
    { code: 'K92.1', description: 'Melena', category: 'Gastrointestinal' },
    // ─── Genitourinary ───
    { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Genitourinary' },
    { code: 'N40.0', description: 'Benign prostatic hyperplasia without lower urinary tract symptoms', category: 'Genitourinary' },
    { code: 'N18.3', description: 'Chronic kidney disease, stage 3 (moderate)', category: 'Genitourinary' },
    { code: 'N18.4', description: 'Chronic kidney disease, stage 4 (severe)', category: 'Genitourinary' },
    // ─── Injuries / Trauma ───
    { code: 'S13.4XXA', description: 'Sprain of ligaments of cervical spine, initial encounter', category: 'Injury' },
    { code: 'S33.5XXA', description: 'Sprain of ligaments of lumbar spine, initial encounter', category: 'Injury' },
    { code: 'S83.401A', description: 'Sprain of unspecified collateral ligament of right knee, initial encounter', category: 'Injury' },
    { code: 'S83.402A', description: 'Sprain of unspecified collateral ligament of left knee, initial encounter', category: 'Injury' },
    { code: 'S93.401A', description: 'Sprain of unspecified ligament of right ankle, initial encounter', category: 'Injury' },
    { code: 'S93.402A', description: 'Sprain of unspecified ligament of left ankle, initial encounter', category: 'Injury' },
    { code: 'S40.011A', description: 'Contusion of right shoulder, initial encounter', category: 'Injury' },
    { code: 'S09.90XA', description: 'Unspecified injury of head, initial encounter', category: 'Injury' },
    { code: 'S09.90XD', description: 'Unspecified injury of head, subsequent encounter', category: 'Injury' },
    { code: 'S09.90XS', description: 'Unspecified injury of head, sequela', category: 'Injury' },
    { code: 'S06.0X0A', description: 'Concussion without loss of consciousness, initial encounter', category: 'Injury' },
    { code: 'S06.0X0D', description: 'Concussion without loss of consciousness, subsequent encounter', category: 'Injury' },
    { code: 'S06.0X0S', description: 'Concussion without loss of consciousness, sequela', category: 'Injury' },
    // ─── Preventive / Wellness ───
    { code: 'Z00.00', description: 'Encounter for general adult medical examination without abnormal findings', category: 'Preventive' },
    { code: 'Z00.01', description: 'Encounter for general adult medical examination with abnormal findings', category: 'Preventive' },
    { code: 'Z00.121', description: 'Encounter for routine child health examination with abnormal findings', category: 'Preventive' },
    { code: 'Z13.89', description: 'Encounter for screening for other disorder', category: 'Preventive' },
    { code: 'Z23', description: 'Encounter for immunization', category: 'Preventive' },
    { code: 'Z71.1', description: 'Person with feared health complaint in whom no diagnosis is made', category: 'Preventive' },
    { code: 'Z71.3', description: 'Dietary counseling and surveillance', category: 'Preventive' },
    // ─── Sleep / Fatigue ───
    { code: 'G47.00', description: 'Insomnia, unspecified', category: 'Sleep' },
    { code: 'G47.10', description: 'Hypersomnia, unspecified', category: 'Sleep' },
    { code: 'G47.33', description: 'Obstructive sleep apnea (adult) (pediatric)', category: 'Sleep' },
    { code: 'R53.83', description: 'Other fatigue', category: 'Sleep' },
    { code: 'R53.1', description: 'Weakness', category: 'Sleep' },
    // ─── Signs & Symptoms (commonly billed) ───
    { code: 'R05.9', description: 'Cough, unspecified', category: 'Symptoms' },
    { code: 'R51.9', description: 'Headache, unspecified', category: 'Symptoms' },
    { code: 'R52', description: 'Pain, unspecified', category: 'Symptoms' },
    { code: 'R55', description: 'Syncope and collapse', category: 'Symptoms' },
    { code: 'R41.3', description: 'Other amnesia', category: 'Symptoms' },
    { code: 'R45.1', description: 'Restlessness and agitation', category: 'Symptoms' },
    { code: 'R45.4', description: 'Irritability and anger', category: 'Symptoms' },
    { code: 'R45.5', description: 'Hostility', category: 'Symptoms' },
    { code: 'R45.6', description: 'Violent behavior', category: 'Symptoms' },
    { code: 'R45.851', description: 'Suicidal ideations', category: 'Symptoms' },
    { code: 'R45.88', description: 'Nonsuicidal self-harm', category: 'Symptoms' },
    { code: 'R41.81', description: 'Age-related cognitive decline', category: 'Symptoms' },
    { code: 'R41.89', description: 'Other symptoms and signs involving cognitive functions and awareness', category: 'Symptoms' },
];
async function seedIcd10Codes(organizationId) {
    let orgs;
    if (organizationId) {
        orgs = [{ id: organizationId }];
    }
    else {
        orgs = await prisma.organization.findMany({ select: { id: true } });
    }
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const seededOrgs = [];
    for (const org of orgs) {
        let created = 0;
        let skipped = 0;
        let errors = 0;
        for (const code of COMMON_ICD10_CODES) {
            try {
                const existing = await prisma.diagnosisCode.findFirst({
                    where: { code: code.code, organizationId: org.id },
                });
                if (existing) {
                    skipped++;
                    continue;
                }
                await prisma.diagnosisCode.create({
                    data: {
                        code: code.code,
                        description: code.description,
                        category: code.category,
                        isActive: true,
                        organizationId: org.id,
                    },
                });
                created++;
            }
            catch (err) {
                console.error(`Error seeding ${code.code} for org ${org.id}:`, err);
                errors++;
            }
        }
        totalCreated += created;
        totalSkipped += skipped;
        totalErrors += errors;
        seededOrgs.push(org.id);
        console.log(`Org ${org.id}: created=${created}, skipped=${skipped}, errors=${errors}`);
    }
    return {
        created: totalCreated,
        skipped: totalSkipped,
        errors: totalErrors,
        organizationsSeeded: seededOrgs,
    };
}
