# Admin-Based Login & User Management System

## 🎯 Overview

This system provides a comprehensive admin portal for managing users, stores, and system settings. It features:

- **Separate Admin Authentication**: Admin login is completely separate from regular user login
- **User Management**: Full CRUD operations for users across all stores
- **Role-Based Access Control (RBAC)**: Four user roles with different permission levels
- **Store Management**: Manage multiple Shopify stores
- **Audit Trail**: Complete logging of all admin actions
- **Admin Dashboard**: Overview of system metrics and activity

## 🚀 Quick Start

### 1. Create Initial Admin User

Run the setup script to create your first admin user:

```bash
cd backend/shopify-dashboard
node scripts/create-admin.js [email] [password] [name]
```

**Example:**
```bash
node scripts/create-admin.js admin@yourdomain.com Admin@123 "Super Admin"
```

**Default credentials (if no arguments provided):**
- Email: `admin@yourdomain.com`
- Password: `Admin@123`
- Name: `Super Admin`

### 2. Set Environment Variables

Make sure you have these environment variables set in your `.env.local`:

```env
# Admin JWT Secret (MUST be different from user secret)
ADMIN_JWT_SECRET=your-super-secret-admin-key-12345-abcdef

# User JWT Secret (NextAuth)
NEXTAUTH_SECRET=your-nextauth-secret
```

### 3. Access Admin Portal

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Navigate to: `http://localhost:3002/admin/login`

3. Login with your admin credentials

## 📁 Data Structure

The system uses a structured data organization:

```
data/
├── admin/                          # Admin-only data
│   ├── admin-users.json           # Admin accounts
│   ├── system-settings.json       # System configuration
│   └── audit-logs.json            # Admin action logs
│
└── stores/                         # Per-store data
    ├── store_default/
    │   ├── users.json             # Store users
    │   ├── journeys.json
    │   ├── campaigns.json
    │   └── segments.json
    │
    └── store-registry.json        # All connected stores
```

## 🔐 Authentication Flow

### Admin Login
- **URL**: `/admin/login`
- **Cookie**: `admin_session`
- **Token Type**: `type: 'admin'`
- **Secret**: `ADMIN_JWT_SECRET`

### User Login
- **URL**: `/auth/signin`
- **Cookie**: `next-auth.session-token` or `user_session`
- **Token Type**: `type: 'user'`
- **Secret**: `NEXTAUTH_SECRET`

## 👥 User Roles & Permissions

### Admin Role
- **Permissions**: All permissions (`*`)
- **Access**: Full access to all features and settings

### Manager Role
- **Permissions**:
  - Campaigns (view, create, edit, send)
  - Segments (view, create, edit)
  - Customers (view, export)
  - Analytics (view)

### Builder Role
- **Permissions**:
  - Journeys (view, create, edit, activate)
  - Segments (view, create, edit)
  - Customers (view)

### Viewer Role
- **Permissions**: Read-only access
  - Journeys (view)
  - Campaigns (view)
  - Customers (view)
  - Segments (view)
  - Analytics (view)

## 📊 Admin Features

### Dashboard (`/admin`)
- System metrics (users, stores, messages, API calls)
- Recent activity feed
- Storage usage

### User Management (`/admin/users`)
- View all users across all stores
- Create new users
- Edit user details and roles
- Delete users (soft delete)
- Search and filter users
- Export user data

### Store Management (`/admin/stores`)
- View all connected stores
- Store details and statistics
- Manage store status
- View store users

### Settings (`/admin/settings`)
- System configuration
- Security settings
- Feature flags
- Email configuration

### Audit Trail (`/admin/audit`)
- View all admin actions
- Filter by date, admin, action type
- Export audit logs

## 🔧 API Routes

### Admin Authentication
- `POST /api/admin/auth/login` - Admin login
- `POST /api/admin/auth/logout` - Admin logout
- `GET /api/admin/auth/session` - Get current admin session

### User Management
- `GET /api/admin/users` - List all users (with filters)
- `POST /api/admin/users` - Create new user
- `GET /api/admin/users/[id]` - Get user details
- `PATCH /api/admin/users/[id]` - Update user
- `DELETE /api/admin/users/[id]` - Delete user (soft delete)

### Dashboard
- `GET /api/admin/dashboard/stats` - Get dashboard statistics

## 🛡️ Security Features

1. **Separate Admin Authentication**: Admin and user sessions are completely isolated
2. **Password Hashing**: All passwords are hashed using bcrypt
3. **JWT Tokens**: Secure token-based authentication
4. **Audit Logging**: All admin actions are logged
5. **Role-Based Access**: Permissions enforced at API and UI level
6. **Soft Delete**: Users are soft-deleted to maintain audit trail

## 📝 Usage Examples

### Creating a User via API

```typescript
const response = await fetch('/api/admin/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'John Doe',
    email: 'john@store.com',
    password: 'SecurePass123',
    phone: '+1234567890',
    storeId: 'store_default',
    role: 'manager',
    sendWelcomeEmail: true,
  }),
});
```

### Checking Permissions

```typescript
import { hasPermission } from '@/lib/auth/permissions';

const canCreateCampaign = hasPermission(userRole, 'campaigns.create');
```

## 🐛 Troubleshooting

### Admin Login Not Working
1. Check that admin user exists in `data/admin/admin-users.json`
2. Verify `ADMIN_JWT_SECRET` is set in environment variables
3. Check browser console for errors
4. Verify cookie is being set: `admin_session`

### Users Not Showing
1. Check that users exist in `data/stores/{storeId}/users.json`
2. Verify store structure is correct
3. Check API response for errors

### Permission Errors
1. Verify user role is set correctly
2. Check permission mapping in `lib/auth/permissions.ts`
3. Ensure middleware is checking permissions correctly

## 🔄 Migration Notes

Existing users from `data/users.json` have been migrated to:
- `data/stores/store_default/users.json`

The system maintains backward compatibility while supporting multi-store architecture.

## 📚 Next Steps

1. **Customize Roles**: Modify `ROLE_PERMISSIONS` in `lib/auth/permissions.ts`
2. **Add Features**: Extend admin dashboard with custom metrics
3. **Email Integration**: Implement welcome email sending
4. **2FA**: Add two-factor authentication for admin accounts
5. **IP Whitelisting**: Implement IP-based access control

## 🆘 Support

For issues or questions:
1. Check the audit logs in `data/admin/audit-logs.json`
2. Review middleware logs in console
3. Verify data file structure matches expected format

---

**⚠️ Important**: Always change the default admin password after first login!

