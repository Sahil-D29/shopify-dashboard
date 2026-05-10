const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function createAdmin() {
  const args = process.argv.slice(2);
  const email = args[0] || 'admin@yourdomain.com';
  const password = args[1] || 'Admin@123';
  const name = args[2] || 'Super Admin';

  console.log('🔐 Creating admin user...');
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Name: ${name}`);

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Read existing admin users
    const adminDir = path.join(__dirname, '..', 'data', 'admin');
    const adminFile = path.join(adminDir, 'admin-users.json');

    // Ensure directory exists
    if (!fs.existsSync(adminDir)) {
      fs.mkdirSync(adminDir, { recursive: true });
    }

    let adminData = { admins: [] };
    if (fs.existsSync(adminFile)) {
      const existingData = fs.readFileSync(adminFile, 'utf-8');
      adminData = JSON.parse(existingData);
    }

    // Check if admin already exists
    const existingAdmin = adminData.admins.find((a) => a.email.toLowerCase() === email.toLowerCase());
    if (existingAdmin) {
      console.log('⚠️  Admin with this email already exists. Updating password...');
      existingAdmin.password = hashedPassword;
      existingAdmin.name = name;
    } else {
      // Create new admin
      const newAdmin = {
        id: `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role: 'super_admin',
        permissions: ['*'],
        createdAt: new Date().toISOString(),
        lastLogin: null,
        status: 'active',
        mfaEnabled: false,
        ipWhitelist: [],
      };

      adminData.admins.push(newAdmin);
    }

    // Write to file
    fs.writeFileSync(adminFile, JSON.stringify(adminData, null, 2));

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📝 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('');
    console.log('🌐 Login at: http://localhost:3002/admin/login');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the default password after first login!');
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();

