const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.user.createMany({
    data: [
      { email: 'alice@example.com', passwordHash },
      { email: 'bob@example.com', passwordHash },
      { email: 'nishant@example.com', passwordHash },
    ],
    skipDuplicates: true,
  });

  // Seed a dev client with a fixed clientId for local testing
  await prisma.client.upsert({
    where: { clientId: 'clt_dev_testclient' },
    update: {},
    create: {
      clientId: 'clt_dev_testclient',
      name: 'Dev Test Client',
      isPublic: true,
      redirectUris: [
        'http://localhost:3000/callback',
        'http://localhost:5173/callback',
        'http://localhost:8080/callback',
      ],
      scopes: 'openid',
    },
  });

  console.log('Database seeded successfully');
  console.log('Dev client ID: clt_dev_testclient');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
