import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // Clean existing data
  await prisma.projectUser.deleteMany();
  await prisma.projectOrganization.deleteMany();
  await prisma.project.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);
  console.log(`Password hash: ${passwordHash}\n`);

  // Create organizations
  const superAdminOrg = await prisma.organization.create({
    data: { name: 'Super Admin', type: 'SUPER_ADMIN' },
  });
  const bankOrg = await prisma.organization.create({
    data: { name: 'Bank', type: 'CLIENT' },
  });
  const dataEdgeOrg = await prisma.organization.create({
    data: { name: 'Data Edge', type: 'SI' },
  });
  const oracleOrg = await prisma.organization.create({
      data: { name: 'Oracle', type: 'OEM' },
  });

  console.log('Organizations created:');
  console.log(`  ${superAdminOrg.name} (${superAdminOrg.id})`);
  console.log(`  ${bankOrg.name} (${bankOrg.id})`);
  console.log(`  ${dataEdgeOrg.name} (${dataEdgeOrg.id})`);
  console.log(`  ${oracleOrg.name} (${oracleOrg.id})\n`);

  // Create users — 2 per org (1 admin + 1 regular), super admin org gets the SUPER_ADMIN user
  const usersData = [
    { name: 'Super Admin', email: 'superadmin@issuetracker.dev', role: 'SUPER_ADMIN' as const, orgId: superAdminOrg.id },
    { name: 'Super Viewer', email: 'superviewer@issuetracker.dev', role: 'USER' as const, orgId: superAdminOrg.id },
    { name: 'Bank Admin', email: 'bankadmin@issuetracker.dev', role: 'ORG_ADMIN' as const, orgId: bankOrg.id },
    { name: 'Bank User', email: 'bankuser@issuetracker.dev', role: 'USER' as const, orgId: bankOrg.id },
    { name: 'Data Edge Admin', email: 'siadmin@issuetracker.dev', role: 'ORG_ADMIN' as const, orgId: dataEdgeOrg.id },
    { name: 'Data Edge User', email: 'siuser@issuetracker.dev', role: 'USER' as const, orgId: dataEdgeOrg.id },
    { name: 'Oracle Admin', email: 'oracleadmin@issuetracker.dev', role: 'ORG_ADMIN' as const, orgId: oracleOrg.id },
    { name: 'Oracle User', email: 'oracleuser@issuetracker.dev', role: 'USER' as const, orgId: oracleOrg.id },
  ];

  console.log('Users created:');
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        phone: null,
        organizationId: u.orgId,
        role: u.role,
        status: 'ACTIVE',
      },
    });
    console.log(`  ${user.name} (${user.email}) — ${user.role} — ${user.id}`);
  }

  const userCount = await prisma.user.count();
  const orgCount = await prisma.organization.count();
  console.log(`\nTotal: ${orgCount} organizations, ${userCount} users`);

  // Create default project and add all orgs + users
  const project = await prisma.project.create({
    data: {
      name: 'NRB Bank CBS Upgrade',
      description: 'Core banking system upgrade for NRB Bank',
    },
  });
  console.log(`\nProject created: ${project.name} (${project.id})`);

  const allOrgs = [bankOrg, dataEdgeOrg, oracleOrg];
  for (const org of allOrgs) {
    await prisma.projectOrganization.create({
      data: { projectId: project.id, organizationId: org.id },
    });
    console.log(`  Added org: ${org.name}`);
  }

  const allUsers = await prisma.user.findMany();
  for (const user of allUsers) {
    await prisma.projectUser.create({
      data: { projectId: project.id, userId: user.id },
    });
    console.log(`  Added user: ${user.name}`);
  }

  console.log('\nAll passwords: password123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
