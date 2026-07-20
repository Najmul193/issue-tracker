import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...\n');

  // Clean existing data
  await prisma.projectDepartment.deleteMany();
  await prisma.projectUser.deleteMany();
  await prisma.projectOrganization.deleteMany();
  await prisma.project.deleteMany();
  await prisma.departmentManager.deleteMany();
  await prisma.department.deleteMany();
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

  // Create IT departments for each non-super-admin org
  const itDepts: Record<string, string> = {};
  for (const org of [bankOrg, dataEdgeOrg, oracleOrg]) {
    const dept = await prisma.department.create({
      data: { name: 'IT', organizationId: org.id },
    });
    itDepts[org.id] = dept.id;
    console.log(`  IT Department created for ${org.name} (${dept.id})`);
  }
  console.log('');

  // Create users — 2 per org (1 admin + 1 regular), super admin org gets the SUPER_ADMIN user
  const usersData = [
    { name: 'Super Admin', email: 'superadmin@issuetracker.dev', role: 'SUPER_ADMIN' as const, orgId: superAdminOrg.id, deptId: null as string | null },
    { name: 'Super Viewer', email: 'superviewer@issuetracker.dev', role: 'USER' as const, orgId: superAdminOrg.id, deptId: null as string | null },
    { name: 'Bank Admin', email: 'bankadmin@issuetracker.dev', role: 'ORG_ADMIN' as const, orgId: bankOrg.id, deptId: null as string | null },
    { name: 'Bank User', email: 'bankuser@issuetracker.dev', role: 'USER' as const, orgId: bankOrg.id, deptId: itDepts[bankOrg.id] },
    { name: 'Data Edge Admin', email: 'siadmin@issuetracker.dev', role: 'ORG_ADMIN' as const, orgId: dataEdgeOrg.id, deptId: null as string | null },
    { name: 'Data Edge User', email: 'siuser@issuetracker.dev', role: 'USER' as const, orgId: dataEdgeOrg.id, deptId: itDepts[dataEdgeOrg.id] },
    { name: 'Oracle Admin', email: 'oracleadmin@issuetracker.dev', role: 'ORG_ADMIN' as const, orgId: oracleOrg.id, deptId: null as string | null },
    { name: 'Oracle User', email: 'oracleuser@issuetracker.dev', role: 'USER' as const, orgId: oracleOrg.id, deptId: itDepts[oracleOrg.id] },
  ];

  console.log('Users created:');
  const createdUsers: Record<string, string> = {};
  for (const u of usersData) {
    const user = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        phone: null,
        organizationId: u.orgId,
        departmentId: u.deptId,
        role: u.role,
        status: 'ACTIVE',
      },
    });
    createdUsers[u.email] = user.id;
    console.log(`  ${user.name} (${user.email}) — ${user.role} — ${user.id}`);
  }

  // Make ORG_ADMINs managers of their org's IT department
  for (const org of [bankOrg, dataEdgeOrg, oracleOrg]) {
    const adminEmail = org.name === 'Bank' ? 'bankadmin@issuetracker.dev' : org.name === 'Data Edge' ? 'siadmin@issuetracker.dev' : 'oracleadmin@issuetracker.dev';
    const deptId = itDepts[org.id];
    await prisma.departmentManager.create({
      data: { departmentId: deptId, userId: createdUsers[adminEmail] },
    });
    console.log(`  Manager assigned: ${adminEmail} → IT Dept (${org.name})`);
  }
  console.log('');

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

  // Add all departments to project
  for (const org of allOrgs) {
    const deptId = itDepts[org.id];
    await prisma.projectDepartment.create({
      data: { projectId: project.id, departmentId: deptId },
    });
    console.log(`  Added dept: IT (${org.name})`);
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
