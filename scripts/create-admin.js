/**
 * Create or update a SUPER_ADMIN user in the database.
 * Admin login at /admin/login uses Prisma (role = SUPER_ADMIN).
 * Run from project root: node scripts/create-admin.js [email] [password] [name]
 */
const bcrypt = require('bcryptjs');
const path = require('path');

// Load .env.local so DATABASE_URL and Prisma work
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function createAdmin() {
  const args = process.argv.slice(2);
  const email = args[0] || 'admin@yourdomain.com';
  const password = args[1] || 'Admin@123';
  const name = args[2] || 'Super Admin';

  console.log('🔐 Creating admin user (Prisma)...');
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Name: ${name}`);

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Add it to .env.local');
    process.exit(1);
  }

  try {
    const { PrismaClient } = require('@prisma/client');
    const { PrismaNeon } = require('@prisma/adapter-neon');
    const prisma = new PrismaClient({
      adapter: new PrismaNeon({
        connectionString: process.env.DATABASE_URL,
      }),
    });

    const hashedPassword = await bcrypt.hash(password, 12);
    const emailLower = email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existing) {
      if (existing.role !== 'SUPER_ADMIN') {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: 'SUPER_ADMIN',
            passwordHash: hashedPassword,
            name,
            status: 'ACTIVE',
          },
        });
        console.log('⚠️  User existed with different role. Updated to SUPER_ADMIN and password.');
      } else {
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash: hashedPassword, name },
        });
        console.log('⚠️  Admin with this email already exists. Password and name updated.');
      }
    } else {
      await prisma.user.create({
        data: {
          email: emailLower,
          name,
          passwordHash: hashedPassword,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });
      console.log('✅ Admin user created successfully!');
    }

    await prisma.$disconnect();

    console.log('');
    console.log('📝 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('🌐 Login at: http://localhost:3002/admin/login');
    console.log('');
    console.log('⚠️  IMPORTANT: Set ADMIN_JWT_SECRET (or NEXTAUTH_SECRET) in .env.local for admin login to work.');
    console.log('⚠️  Change the default password after first login!');
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();
