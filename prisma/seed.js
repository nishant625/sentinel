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

  console.log('Database seeded successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
