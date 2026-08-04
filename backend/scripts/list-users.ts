import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    select: { id: true, email: true, username: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.table(users);
  await prisma.$disconnect();
}

main();
