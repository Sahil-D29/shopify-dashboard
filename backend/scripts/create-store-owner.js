const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function createStoreOwner() {
  const args = process.argv.slice(2);
  const email = args[0] || 'storeowner@example.com';
  const password = args[1] || 'StoreOwner123!';
  const name = args[2] || 'Store Owner';
  const storeId = args[3] || 'default';

  console.log('🏪 Creating Store Owner user...');
  console.log(`📧 Email: ${email}`);
  console.log(`👤 Name: ${name}`);
  console.log(`🏪 Store ID: ${storeId}`);

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const usersFile = path.join(__dirname, '..', 'data', 'users.json');
    let usersData = { users: [] };
    
    if (fs.existsSync(usersFile)) {
      const fileContent = fs.readFileSync(usersFile, 'utf-8');
      usersData = JSON.parse(fileContent);
    }

    // Check if user already exists
    const existingUser = usersData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      console.log('⚠️  User with this email already exists. Updating to Store Owner...');
      existingUser.role = 'STORE_OWNER';
      existingUser.storeId = storeId;
      existingUser.shopifyStoreId = storeId;
      existingUser.password = hashedPassword;
      existingUser.name = name;
    } else {
      const newUser = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        email: email.toLowerCase(),
        name,
        password: hashedPassword,
        role: 'STORE_OWNER',
        storeId: storeId,
        createdAt: new Date().toISOString(),
        shopifyStoreId: storeId,
        provider: 'credentials'
      };

      usersData.users.push(newUser);
    }

    fs.writeFileSync(usersFile, JSON.stringify(usersData, null, 2));

    console.log('✅ Store Owner created successfully!');
    console.log('');
    console.log('📝 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Store ID: ${storeId}`);
    console.log('');
    console.log('🌐 Login at: http://localhost:3002/auth/signin');
    console.log('');
    console.log('⚠️  IMPORTANT: Change the password after first login!');
  } catch (error) {
    console.error('❌ Error creating store owner:', error);
    process.exit(1);
  }
}

createStoreOwner();




