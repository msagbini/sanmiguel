import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';  // o bcrypt según lo que tengas

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@admin.com';
  const password = 'admin';
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name: 'Administrador',
      // Si hay otros campos obligatorios, agrégalos (rol, etc.)
    },
  });
  console.log('Usuario creado:', user);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
