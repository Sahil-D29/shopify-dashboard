# Database Migration Guide: File-Based Storage to PostgreSQL

## 🎯 Purpose of Migrating to Database

### Current Limitations of File-Based Storage

1. **Concurrency Issues**
   - File locks prevent simultaneous writes but limit scalability
   - Race conditions can occur with high concurrent requests
   - No transaction support for multi-step operations

2. **Performance Bottlenecks**
   - Entire file must be read/written for any operation
   - No indexing for fast queries
   - O(n) search complexity for finding records
   - Memory overhead loading entire datasets

3. **Scalability Constraints**
   - Cannot scale horizontally (multiple server instances)
   - File system becomes a single point of failure
   - No built-in replication or backup mechanisms
   - Limited to single-server deployments

4. **Data Integrity**
   - No foreign key constraints
   - No referential integrity checks
   - Manual validation required
   - Risk of data corruption on crashes

5. **Query Limitations**
   - No complex filtering, sorting, or aggregation
   - No joins between related data
   - Manual pagination implementation
   - No full-text search capabilities

6. **Development Experience**
   - Difficult to test with file mocks
   - No migration system for schema changes
   - Harder to debug data issues
   - No built-in data validation

### Benefits of Database Migration

1. **Performance**
   - Indexed queries (O(log n) vs O(n))
   - Connection pooling for efficient resource usage
   - Query optimization by database engine
   - Caching at database level

2. **Scalability**
   - Horizontal scaling with read replicas
   - Load balancing across multiple instances
   - Database clustering for high availability
   - Support for millions of records

3. **Data Integrity**
   - ACID transactions guarantee consistency
   - Foreign key constraints prevent orphaned records
   - Unique constraints prevent duplicates
   - Check constraints validate data

4. **Advanced Features**
   - Complex queries with JOINs, aggregations
   - Full-text search capabilities
   - JSON column support for flexible schemas
   - Time-series data optimization
   - Backup and point-in-time recovery

5. **Developer Experience**
   - Type-safe queries with Prisma
   - Automatic migrations
   - Database introspection
   - Better debugging tools
   - ORM abstraction layer

6. **Production Ready**
   - Connection pooling
   - Query logging and monitoring
   - Performance insights
   - Automated backups
   - Disaster recovery

---

## 📊 Database Schema Design

### Technology Stack

- **Database**: PostgreSQL (recommended) or MySQL
- **ORM**: Prisma (already installed)
- **Migration Tool**: Prisma Migrate
- **Connection**: Connection pooling with PgBouncer (production)

### Schema Overview

```
┌─────────────┐
│    Users    │
└──────┬──────┘
       │
       ├───┐
       │   │
       ▼   ▼
┌─────────────┐  ┌─────────────┐
│StoreMembers │  │  Stores     │
└─────────────┘  └─────────────┘
       │                │
       │                ├───┐
       │                │   │
       ▼                ▼   ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Segments   │  │ Campaigns   │  │  Journeys   │
└─────────────┘  └─────────────┘  └─────────────┘
       │                │                │
       └────────────────┴────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │ CampaignLogs    │
              │ JourneyLogs     │
              │ ActivityLogs    │
              └─────────────────┘
```

---

## 🗄️ Detailed Schema Design

### Core Tables

#### 1. **Users** (`users`)
Stores user accounts and authentication data.

```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  passwordHash  String?  // Nullable for OAuth users
  role          UserRole @default(VIEWER)
  status        UserStatus @default(ACTIVE)
  invitedBy     String?
  lastLogin     DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  ownedStores   Store[]  @relation("StoreOwner")
  storeMembers  StoreMember[]
  createdCampaigns Campaign[] @relation("CampaignCreator")
  createdJourneys Journey[] @relation("JourneyCreator")
  createdSegments Segment[] @relation("SegmentCreator")
  activityLogs ActivityLog[]
  
  @@index([email])
  @@index([role])
  @@index([status])
}
```

#### 2. **Stores** (`stores`)
Shopify store configurations and credentials.

```prisma
model Store {
  id              String   @id @default(uuid())
  shopifyDomain   String   @unique
  shopifyStoreId  String   @unique
  storeName       String
  accessToken     String   // Encrypted
  scope          String
  isActive       Boolean  @default(true)
  installedAt    DateTime @default(now())
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  // Relations
  ownerId        String
  owner          User     @relation("StoreOwner", fields: [ownerId], references: [id])
  members        StoreMember[]
  segments       Segment[]
  campaigns      Campaign[]
  journeys       Journey[]
  subscriptions  Subscription[]
  
  @@index([shopifyDomain])
  @@index([ownerId])
}
```

#### 3. **StoreMembers** (`store_members`)
Many-to-many relationship between users and stores with roles.

```prisma
model StoreMember {
  id          String   @id @default(uuid())
  userId      String
  storeId     String
  role        StoreRole @default(TEAM_MEMBER)
  permissions Json?    // Custom permissions override
  status      MemberStatus @default(ACTIVE)
  invitedBy   String?
  joinedAt    DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  
  @@unique([userId, storeId])
  @@index([userId])
  @@index([storeId])
  @@index([status])
}
```

#### 4. **Segments** (`segments`)
Customer segmentation definitions.

```prisma
model Segment {
  id          String   @id @default(uuid())
  storeId     String
  name        String
  description String?
  filters     Json     // Segment filter criteria
  customerCount Int    @default(0) // Cached count
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  store       Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  createdBy   String
  creator     User     @relation("SegmentCreator", fields: [createdBy], references: [id])
  campaigns   Campaign[]
  journeyEnrollments JourneyEnrollment[]
  
  @@index([storeId])
  @@index([createdBy])
  @@index([isActive])
}
```

#### 5. **Campaigns** (`campaigns`)
Marketing campaign definitions.

```prisma
model Campaign {
  id            String   @id @default(uuid())
  storeId       String
  name          String
  description   String?
  type          CampaignType
  status        CampaignStatus @default(DRAFT)
  segmentId     String?
  messageTemplate Json   // Message content
  scheduleType  ScheduleType
  scheduledAt   DateTime?
  executedAt    DateTime?
  completedAt   DateTime?
  
  // Metrics
  totalSent     Int      @default(0)
  totalDelivered Int     @default(0)
  totalOpened   Int      @default(0)
  totalClicked  Int      @default(0)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  segment       Segment? @relation(fields: [segmentId], references: [id], onDelete: SetNull)
  createdBy     String
  creator       User     @relation("CampaignCreator", fields: [createdBy], references: [id])
  logs          CampaignLog[]
  
  @@index([storeId])
  @@index([status])
  @@index([segmentId])
  @@index([scheduledAt])
  @@index([createdBy])
}
```

#### 6. **CampaignLogs** (`campaign_logs`)
Execution logs for campaigns.

```prisma
model CampaignLog {
  id          String   @id @default(uuid())
  campaignId  String
  customerId  String   // Shopify customer ID
  status      LogStatus
  message     String?
  error       String?
  metadata    Json?
  createdAt   DateTime @default(now())
  
  // Relations
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  @@index([campaignId])
  @@index([status])
  @@index([createdAt])
}
```

#### 7. **Journeys** (`journeys`)
Customer journey automation definitions.

```prisma
model Journey {
  id            String   @id @default(uuid())
  storeId       String
  name          String
  description   String?
  definition    Json     // Journey flow definition (nodes, edges)
  status        JourneyStatus @default(DRAFT)
  triggerType   TriggerType
  triggerConfig Json     // Trigger configuration
  
  // Stats
  totalEnrollments Int   @default(0)
  activeEnrollments Int  @default(0)
  completedEnrollments Int @default(0)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  store         Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  createdBy     String
  creator       User     @relation("JourneyCreator", fields: [createdBy], references: [id])
  enrollments   JourneyEnrollment[]
  logs          JourneyLog[]
  
  @@index([storeId])
  @@index([status])
  @@index([createdBy])
}
```

#### 8. **JourneyEnrollments** (`journey_enrollments`)
Customer enrollments in journeys.

```prisma
model JourneyEnrollment {
  id          String   @id @default(uuid())
  journeyId   String
  customerId  String   // Shopify customer ID
  segmentId   String?  // Segment that triggered enrollment
  currentNode String?  // Current node in journey
  status      EnrollmentStatus @default(ACTIVE)
  enrolledAt  DateTime @default(now())
  completedAt DateTime?
  metadata    Json?
  
  // Relations
  journey     Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  segment     Segment? @relation(fields: [segmentId], references: [id], onDelete: SetNull)
  
  @@unique([journeyId, customerId])
  @@index([journeyId])
  @@index([customerId])
  @@index([status])
  @@index([enrolledAt])
}
```

#### 9. **JourneyLogs** (`journey_logs`)
Execution logs for journey steps.

```prisma
model JourneyLog {
  id          String   @id @default(uuid())
  journeyId   String
  enrollmentId String?
  customerId  String
  nodeId      String
  action      String
  status      LogStatus
  message     String?
  error       String?
  metadata    Json?
  createdAt   DateTime @default(now())
  
  // Relations
  journey     Journey  @relation(fields: [journeyId], references: [id], onDelete: Cascade)
  
  @@index([journeyId])
  @@index([enrollmentId])
  @@index([customerId])
  @@index([status])
  @@index([createdAt])
}
```

#### 10. **Subscriptions** (`subscriptions`)
Subscription plans and billing information.

```prisma
model Subscription {
  id              String   @id @default(uuid())
  storeId         String   @unique
  planId          String
  planName        String
  status          SubscriptionStatus
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd Boolean @default(false)
  stripeCustomerId String?
  stripeSubscriptionId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  // Relations
  store           Store    @relation(fields: [storeId], references: [id], onDelete: Cascade)
  payments        Payment[]
  
  @@index([status])
  @@index([currentPeriodEnd])
}
```

#### 11. **Payments** (`payments`)
Payment history and transactions.

```prisma
model Payment {
  id              String   @id @default(uuid())
  subscriptionId  String
  amount          Decimal  @db.Decimal(10, 2)
  currency        String   @default("USD")
  status          PaymentStatus
  stripePaymentId String?
  paidAt          DateTime?
  createdAt       DateTime @default(now())
  
  // Relations
  subscription    Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  
  @@index([subscriptionId])
  @@index([status])
  @@index([paidAt])
}
```

#### 12. **ActivityLogs** (`activity_logs`)
Audit trail for user actions.

```prisma
model ActivityLog {
  id          String   @id @default(uuid())
  userId      String?
  storeId     String?
  action      String
  resource    String?
  resourceId  String?
  details     Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  
  // Relations
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([userId])
  @@index([storeId])
  @@index([action])
  @@index([createdAt])
}
```

#### 13. **ErrorLogs** (`error_logs`)
System error tracking.

```prisma
model ErrorLog {
  id          String   @id @default(uuid())
  level       ErrorLevel @default(ERROR)
  message     String
  stack       String?
  context     Json?
  userId      String?
  storeId     String?
  resolved    Boolean  @default(false)
  resolvedAt  DateTime?
  createdAt   DateTime @default(now())
  
  @@index([level])
  @@index([resolved])
  @@index([createdAt])
}
```

#### 14. **SystemHealth** (`system_health`)
System health monitoring metrics.

```prisma
model SystemHealth {
  id          String   @id @default(uuid())
  service     String
  status      HealthStatus
  metrics     Json?
  message     String?
  checkedAt   DateTime @default(now())
  
  @@index([service])
  @@index([status])
  @@index([checkedAt])
}
```

#### 15. **Invitations** (`invitations`)
Pending team member invitations.

```prisma
model Invitation {
  id          String   @id @default(uuid())
  storeId     String
  email       String
  role        StoreRole
  invitedBy   String
  token       String   @unique
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime @default(now())
  
  // Relations
  inviter     User     @relation(fields: [invitedBy], references: [id], onDelete: Cascade)
  
  @@index([storeId])
  @@index([email])
  @@index([token])
  @@index([expiresAt])
}
```

---

## 📝 Enums

```prisma
enum UserRole {
  SUPER_ADMIN
  STORE_OWNER
  MANAGER
  TEAM_MEMBER
  VIEWER
}

enum UserStatus {
  ACTIVE
  INACTIVE
  PENDING_INVITATION
}

enum StoreRole {
  OWNER
  MANAGER
  TEAM_MEMBER
  VIEWER
}

enum MemberStatus {
  ACTIVE
  PENDING
  INACTIVE
}

enum CampaignType {
  EMAIL
  SMS
  WHATSAPP
  PUSH
}

enum CampaignStatus {
  DRAFT
  SCHEDULED
  QUEUED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum ScheduleType {
  IMMEDIATE
  SCHEDULED
  RECURRING
}

enum JourneyStatus {
  DRAFT
  ACTIVE
  PAUSED
  ARCHIVED
}

enum TriggerType {
  ORDER_CREATED
  CUSTOMER_CREATED
  CHECKOUT_ABANDONED
  SEGMENT_JOINED
  CUSTOM
}

enum EnrollmentStatus {
  ACTIVE
  COMPLETED
  CANCELLED
}

enum LogStatus {
  PENDING
  SUCCESS
  FAILED
}

enum SubscriptionStatus {
  ACTIVE
  TRIALING
  PAST_DUE
  CANCELLED
  UNPAID
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  REFUNDED
}

enum ErrorLevel {
  INFO
  WARNING
  ERROR
  CRITICAL
}

enum HealthStatus {
  HEALTHY
  DEGRADED
  DOWN
}
```

---

## 🔧 Prisma Schema File

The complete Prisma schema will be created in `backend/shopify-dashboard/prisma/schema.prisma`.

### Key Features

1. **UUID Primary Keys**: All tables use UUID for better distribution
2. **Timestamps**: Automatic `createdAt` and `updatedAt` tracking
3. **Soft Deletes**: Can be added with `deletedAt` field if needed
4. **Indexes**: Strategic indexes for common query patterns
5. **Cascading Deletes**: Proper cleanup of related records
6. **JSON Columns**: Flexible storage for complex data (filters, templates, configs)

---

## 🚀 Migration Strategy

### Phase 1: Setup (Week 1)
1. Install PostgreSQL locally or use cloud service (Neon, Supabase, AWS RDS)
2. Create Prisma schema file
3. Set up database connection
4. Run initial migration

### Phase 2: Data Migration (Week 2)
1. Create migration scripts to import JSON files
2. Validate data integrity
3. Run migration in staging environment
4. Test all CRUD operations

### Phase 3: Code Migration (Week 3-4)
1. Replace `readFileSafe`/`writeFileSafe` with Prisma queries
2. Update all route handlers
3. Update service layers
4. Add database transactions where needed

### Phase 4: Testing & Optimization (Week 5)
1. Performance testing
2. Query optimization
3. Add missing indexes
4. Load testing

### Phase 5: Production Deployment (Week 6)
1. Backup existing file data
2. Run migration script
3. Deploy updated code
4. Monitor for issues

---

## 📋 Next Steps

1. **Create Prisma Schema**: Generate `schema.prisma` file
2. **Set Up Database**: Configure PostgreSQL connection
3. **Create Migration Script**: Import existing JSON data
4. **Update Services**: Replace file operations with Prisma
5. **Add Tests**: Database integration tests

Would you like me to:
1. Generate the complete Prisma schema file?
2. Create migration scripts to import existing JSON data?
3. Start updating specific services to use Prisma?


