# 🔐 How to Access as Admin or Store Owner

## 📋 Quick Overview

Your system has **TWO separate login systems**:

1. **Admin Login** (`/admin/login`) - For system administrators
2. **Regular User Login** (`/auth/signin`) - For store owners and regular users

---

## 🎯 OPTION 1: Access as ADMIN

### Step 1: Check if Admin User Exists

You already have an admin user created! Check the file:
- `backend/shopify-dashboard/data/admin/admin-users.json`

**Default Admin Credentials:**
- **Email**: `admin@yourdomain.com`
- **Password**: `Admin@123`

### Step 2: Login as Admin

1. **Navigate to**: `http://localhost:3002/admin/login`
2. **Enter credentials**:
   - Email: `admin@yourdomain.com`
   - Password: `Admin@123`
3. **Click "Sign In"**

### Step 3: Create New Admin (Optional)

If you want to create a different admin user:

```bash
cd backend/shopify-dashboard
node scripts/create-admin.js your-email@example.com YourPassword123 "Your Name"
```

**Example:**
```bash
node scripts/create-admin.js admin@myshop.com MySecurePass123 "Super Admin"
```

---

## 🏪 OPTION 2: Access as STORE_OWNER

Store owners use the **regular user login** (`/auth/signin`), but need to have:
- `role: "STORE_OWNER"` or `role: "store_owner"`
- `storeId: "your-store-id"` assigned

### Method 1: Create Store Owner via Admin Panel (Recommended)

1. **Login as Admin** (see Option 1 above)
2. **Navigate to**: `/admin/users`
3. **Click "Add User"**
4. **Fill in the form**:
   - Name: Store Owner Name
   - Email: storeowner@example.com
   - Password: (set a secure password)
   - Store: Select the store
   - Role: Select **"manager"** (this maps to STORE_OWNER in the system)
5. **Click "Create User"**

### Method 2: Manually Edit User File

Edit `backend/data/users.json` and add a user with STORE_OWNER role:

```json
{
  "users": [
    {
      "id": "user_store_owner_001",
      "email": "storeowner@example.com",
      "name": "Store Owner",
      "password": "$2b$12$...",  // Hashed password (see below)
      "role": "STORE_OWNER",
      "storeId": "default-store-id",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**To hash password**, use Node.js:
```javascript
const bcrypt = require('bcryptjs');
const hash = await bcrypt.hash('YourPassword123', 12);
console.log(hash);
```

### Method 3: Create Store Owner via Script

Create a script `backend/scripts/create-store-owner.js`:

```javascript
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function createStoreOwner() {
  const args = process.argv.slice(2);
  const email = args[0] || 'storeowner@example.com';
  const password = args[1] || 'StoreOwner123!';
  const name = args[2] || 'Store Owner';
  const storeId = args[3] || 'default';

  const hashedPassword = await bcrypt.hash(password, 12);
  
  const usersFile = path.join(__dirname, '..', 'data', 'users.json');
  let usersData = { users: [] };
  
  if (fs.existsSync(usersFile)) {
    usersData = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  }

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
  fs.writeFileSync(usersFile, JSON.stringify(usersData, null, 2));

  console.log('✅ Store Owner created!');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Store ID: ${storeId}`);
}

createStoreOwner();
```

**Run it:**
```bash
cd backend
node scripts/create-store-owner.js storeowner@example.com MyPassword123 "Store Owner" default-store-id
```

### Step 4: Login as Store Owner

1. **Navigate to**: `http://localhost:3002/auth/signin`
2. **Enter credentials** (email and password you created)
3. **Click "Sign In"**

---

## 🔍 Verify Your Role

After logging in, you can check your role by:

1. **Check the API**: `http://localhost:3002/api/user/permissions`
   - Should show: `"role": "ADMIN"` or `"role": "STORE_OWNER"`

2. **Check Settings Access**:
   - **ADMIN**: Can access `/settings` and see all stores
   - **STORE_OWNER**: Can access `/settings` but only see their store
   - **USER**: Cannot access `/settings` (redirected to dashboard)

---

## 📝 Current Admin User

Based on your files, you have:

**Admin User:**
- **Email**: `admin@yourdomain.com`
- **Password**: `Admin@123` (default - **CHANGE THIS!**)
- **Login URL**: `http://localhost:3002/admin/login`

**⚠️ IMPORTANT**: Change the default password after first login!

---

## 🎯 Quick Test

### Test Admin Access:
```bash
# 1. Go to: http://localhost:3002/admin/login
# 2. Login with: admin@yourdomain.com / Admin@123
# 3. You should see the Admin Dashboard
```

### Test Store Owner Access:
```bash
# 1. Create a store owner (use Method 1, 2, or 3 above)
# 2. Go to: http://localhost:3002/auth/signin
# 3. Login with store owner credentials
# 4. You should see the regular dashboard with Settings access
```

---

## 🔧 Troubleshooting

### "Invalid credentials" error:
- Check if user exists in the correct file
- Verify password is correctly hashed
- Check email is lowercase in the file

### "Unauthorized" error:
- Verify role is set correctly: `"ADMIN"`, `"STORE_OWNER"`, or `"USER"`
- Check `storeId` is set for STORE_OWNER
- Ensure user status is `"active"`

### Can't see Settings page:
- **ADMIN**: Should always see Settings
- **STORE_OWNER**: Should see Settings (limited to their store)
- **USER**: Will NOT see Settings (this is correct behavior)

---

## 📚 Summary

| Role | Login URL | Default Credentials | Can Access Settings? |
|------|-----------|---------------------|---------------------|
| **ADMIN** | `/admin/login` | `admin@yourdomain.com` / `Admin@123` | ✅ Yes (all stores) |
| **STORE_OWNER** | `/auth/signin` | (create via admin panel) | ✅ Yes (own store) |
| **USER** | `/auth/signin` | (create via admin panel) | ❌ No |

---

## 🚀 Next Steps

1. **Login as Admin** using the default credentials
2. **Change the admin password** (security best practice)
3. **Create a store owner** via the admin panel
4. **Test both roles** to verify access control




