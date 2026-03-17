import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create organization first (createdById is now optional)
  const org = await prisma.organization.create({
    data: {
      name: 'Forager Medical Group',
      addresses: [
        {
          street: '123 Healthcare Blvd',
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          type: 'primary',
        },
      ],
      phone: '415-555-0100',
      email: 'contact@foragermedical.com',
      npi: '1234567890',
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
    },
  });

  console.log(`✅ Created organization: ${org.name} (${org.id})`);

  // Create admin user
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@forager.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Admin',
      role: 'Admin',
      organizationId: org.id,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
    },
  });

  console.log(`✅ Created admin user: ${adminUser.email} (${adminUser.id})`);

  // Update organization with correct createdById
  await prisma.organization.update({
    where: { id: org.id },
    data: { createdById: adminUser.id },
  });

  console.log(`✅ Updated organization createdById`);

  // Create a biller user
  const billerUser = await prisma.user.create({
    data: {
      email: 'biller@forager.com',
      passwordHash: await bcrypt.hash('password123', 10),
      firstName: 'Sarah',
      lastName: 'Biller',
      role: 'Biller',
      organizationId: org.id,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
    },
  });

  console.log(`✅ Created biller user: ${billerUser.email}`);

  // Create payor with plans
  const payor = await prisma.payor.create({
    data: {
      name: 'Blue Cross Blue Shield',
      externalPayorId: 'BCBS-CA-001',
      payorCategory: 'Commercial',
      billingTaxonomy: '3336C0003X',
      phone: '800-555-BCBS',
      portalUrl: 'https://portal.bcbs.com',
      organizationId: org.id,
      createdById: adminUser.id,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      plans: {
        create: [
          {
            planName: 'BCBS PPO Gold',
            planType: 'PPO',
            isInNetwork: true,
            createdAt: BigInt(Math.floor(Date.now() / 1000)),
            updatedAt: BigInt(Math.floor(Date.now() / 1000)),
          },
          {
            planName: 'BCBS HMO Silver',
            planType: 'HMO',
            isInNetwork: true,
            createdAt: BigInt(Math.floor(Date.now() / 1000)),
            updatedAt: BigInt(Math.floor(Date.now() / 1000)),
          },
        ],
      },
    },
    include: { plans: true },
  });

  console.log(`✅ Created payor: ${payor.name} with ${payor.plans.length} plans`);

  // Create patient with insurance
  const patient = await prisma.patient.create({
    data: {
      firstName: 'Jane',
      middleName: 'Marie',
      lastName: 'Doe',
      suffix: 'Jr',
      prefix: 'Ms',
      dateOfBirth: BigInt(new Date('1985-03-15').getTime() / 1000),
      gender: 'Female',
      phone: '415-555-0123',
      email: 'jane.doe@email.com',
      address: {
        street: '456 Patient St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94103',
      },
      organizationId: org.id,
      source: 'Forager',
      createdById: adminUser.id,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      insurancePolicies: {
        create: [
          {
            planId: payor.plans[0].id,
            isPrimary: true,
            insuredType: 'Subscriber',
            memberId: 'BCBS123456789',
            createdAt: BigInt(Math.floor(Date.now() / 1000)),
            updatedAt: BigInt(Math.floor(Date.now() / 1000)),
          },
        ],
      },
    },
    include: { insurancePolicies: true },
  });

  console.log(`✅ Created patient: ${patient.firstName} ${patient.lastName} with ${patient.insurancePolicies.length} insurance`);

  // Create provider
  const provider = await prisma.provider.create({
    data: {
      firstName: 'Sarah',
      middleName: 'Elizabeth',
      lastName: 'Smith',
      npi: '9876543210',
      specialty: 'Family Medicine',
      licenseType: 'MD',
      organizationId: org.id,
      source: 'Forager',
      createdById: adminUser.id,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
    },
  });

  console.log(`✅ Created provider: Dr. ${provider.firstName} ${provider.lastName}`);

  // Create CPT codes
  const cptCodes = await prisma.cPTCode.createMany({
    data: [
      {
        code: '99213',
        description: 'Office visit, established patient, 20-29 minutes',
        specialty: 'General',
        basePrice: 150.00,
        organizationId: org.id,
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
      {
        code: '99214',
        description: 'Office visit, established patient, 30-39 minutes',
        specialty: 'General',
        basePrice: 200.00,
        organizationId: org.id,
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
      {
        code: '99385',
        description: 'Initial comprehensive preventive medicine, 18-39 years',
        specialty: 'Preventive',
        basePrice: 250.00,
        organizationId: org.id,
        createdAt: BigInt(Math.floor(Date.now() / 1000)),
        updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      },
    ],
  });

  console.log(`✅ Created ${cptCodes.count} CPT codes`);

  const cptCode = await prisma.cPTCode.findFirst({ where: { code: '99213' } });

  // Create visit
  const visit = await prisma.visit.create({
    data: {
      patientId: patient.id,
      providerId: provider.id,
      organizationId: org.id,
      visitDate: BigInt(Math.floor(Date.now() / 1000)),
      visitTime: BigInt(Math.floor(Date.now() / 1000)),
      duration: 30,
      visitType: 'FollowUp',
      location: 'InClinic',
      status: 'Completed',
      notes: 'Patient presented for routine follow-up. Vitals stable. No new concerns.',
      source: 'Forager',
      createdById: adminUser.id,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
    },
  });

  console.log(`✅ Created visit: ${visit.id}`);

  // Create claim with services
  const claim = await prisma.claim.create({
    data: {
      claimNumber: `CLM-${Date.now()}`,
      visitId: visit.id,
      patientId: patient.id,
      providerId: provider.id,
      payorId: payor.id,
      serviceDate: BigInt(Math.floor(Date.now() / 1000)),
      billedAmount: 150.00,
      status: 'Pending',
      organizationId: org.id,
      source: 'Forager',
      createdById: adminUser.id,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
      services: {
        create: [
          {
            cptCodeId: cptCode!.id,
            description: 'Office visit',
            quantity: 1,
            unitPrice: 150.00,
            totalPrice: 150.00,
            createdAt: BigInt(Math.floor(Date.now() / 1000)),
          },
        ],
      },
      timeline: {
        create: [
          {
            action: 'Created',
            status: 'Pending',
            notes: 'Claim created with status: Pending',
            createdAt: BigInt(Math.floor(Date.now() / 1000)),
          },
        ],
      },
    },
    include: { services: true, timeline: true },
  });

  console.log(`✅ Created claim: ${claim.claimNumber} with ${claim.services.length} services`);

  // Create rule
  const rule = await prisma.rule.create({
    data: {
      name: 'Auto-verify insurance eligibility',
      description: 'Automatically check insurance eligibility when a visit is scheduled',
      triggerType: 'VisitScheduled',
      organizationId: org.id,
      isActive: true,
      flowData: {
        nodes: [
          { id: '1', type: 'trigger', data: { label: 'Visit Scheduled' } },
          { id: '2', type: 'action', data: { label: 'Check Eligibility' } },
        ],
        edges: [{ id: 'e1-2', source: '1', target: '2' }],
      },
      createdById: adminUser.id,
      createdAt: BigInt(Math.floor(Date.now() / 1000)),
      updatedAt: BigInt(Math.floor(Date.now() / 1000)),
    },
  });

  console.log(`✅ Created rule: ${rule.name}`);

  console.log('');
  console.log('========================================');
  console.log('✅ Database seeded successfully!');
  console.log('========================================');
  console.log('');
  console.log('Test Credentials:');
  console.log('  Email: admin@forager.com');
  console.log('  Password: password123');
  console.log('');
  console.log('IDs for testing:');
  console.log(`  Organization: ${org.id}`);
  console.log(`  Admin User: ${adminUser.id}`);
  console.log(`  Patient: ${patient.id}`);
  console.log(`  Provider: ${provider.id}`);
  console.log(`  Payor: ${payor.id}`);
  console.log(`  Visit: ${visit.id}`);
  console.log(`  Claim: ${claim.id}`);
  console.log(`  Rule: ${rule.id}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
