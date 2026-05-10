# Database Setup Quick Start Guide

## 🚀 Quick Setup Steps

### 1. Install PostgreSQL

**Option A: Local Installation**
- Download PostgreSQL from https://www.postgresql.org/download/
- Install and create a database named `shopify_dashboard`

**Option B: Cloud Database (Recommended)**
- **Neon** (Free tier): https://neon.tech
- **Supabase** (Free tier): https://supabase.com
- **AWS RDS** (Paid): https://aws.amazon.com/rds/
- **Railway** (Free tier): https://railway.app

### 2. Set Up Environment Variables

Add to `backend/shopify-dashboard/.env.local`:

```env
# Database Connection
DATABASE_URL="postgresql://username:password@localhost:5432/shopify_dashboard?schema=public"

# For Neon/Supabase (example):
# DATABASE_URL="postgresql://user:pass@host.neon.tech:5432/dbname?sslmode=require"
```

### 3. Initialize Prisma

```bash
cd backend/shopify-dashboard
npx prisma generate
npx prisma migrate dev --name init
```

This will:
- Generate Prisma Client
- Create all database tables
- Set up migrations

### 4. Verify Setup

```bash
# Open Prisma Studio (visual database browser)
npx prisma studio
```

### 5. Migrate Existing Data (Optional)

Create a migration script to import JSON files:

```bash
# Run migration script (to be created)
node scripts/migrate-from-files.js
```

---

## 📋 Prisma Commands Reference

```bash
# Generate Prisma Client (after schema changes)
npx prisma generate

# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations in production
npx prisma migrate deploy

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio

# Format schema file
npx prisma format

# Validate schema
npx prisma validate
```

---

## 🔄 Migration Workflow

### Development
1. Make changes to `schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name`
3. Prisma will:
   - Create migration SQL
   - Apply to database
   - Regenerate Prisma Client

### Production
1. Deploy schema changes
2. Run `npx prisma migrate deploy`
3. This applies pending migrations without prompts

---

## 🛠️ Using Prisma Client

### Example: Replace File Operations

**Before (File-based):**
```typescript
import { readFileSafe, writeFileSafe } from '@/lib/fileStorage';

// Read users
const data = await readFileSafe('users.json');
const users = data.users;

// Create user
data.users.push(newUser);
await writeFileSafe('users.json', data);
```

**After (Database):**
```typescript
import { prisma } from '@/lib/prisma';

// Read users
const users = await prisma.user.findMany();

// Create user
const newUser = await prisma.user.create({
  data: {
    email: 'user@example.com',
    name: 'John Doe',
    role: 'VIEWER',
  },
});
```

---

## 📊 Database Schema Overview

### Core Entities
- **Users**: User accounts and authentication
- **Stores**: Shopify store configurations
- **StoreMembers**: User-store relationships with roles
- **Segments**: Customer segmentation
- **Campaigns**: Marketing campaigns
- **Journeys**: Automation workflows
- **Subscriptions**: Billing and plans

### Logging & Monitoring
- **ActivityLogs**: User action audit trail
- **ErrorLogs**: System error tracking
- **SystemHealth**: Health check metrics
- **CampaignLogs**: Campaign execution logs
- **JourneyLogs**: Journey execution logs

---

## 🔐 Security Best Practices

1. **Encrypt Sensitive Data**
   - Store access tokens encrypted
   - Use environment variables for secrets

2. **Connection Pooling**
   - Use PgBouncer in production
   - Set appropriate pool size

3. **Backup Strategy**
   - Daily automated backups
   - Point-in-time recovery enabled

4. **Access Control**
   - Use database roles and permissions
   - Limit connection IPs in production

---

## 🐛 Troubleshooting

### Connection Issues
```bash
# Test connection
npx prisma db pull

# Check connection string format
echo $DATABASE_URL
```

### Migration Issues
```bash
# Reset and reapply (development only)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

### Prisma Client Not Found
```bash
# Regenerate client
npx prisma generate
```

---

## 📚 Next Steps

1. ✅ Set up database connection
2. ✅ Run initial migration
3. ⏭️ Create data migration script
4. ⏭️ Update services to use Prisma
5. ⏭️ Test all CRUD operations
6. ⏭️ Deploy to production

---

## 💡 Tips

- Use Prisma Studio for quick data inspection
- Keep migrations small and focused
- Test migrations in staging first
- Backup before major migrations
- Use transactions for multi-step operations


