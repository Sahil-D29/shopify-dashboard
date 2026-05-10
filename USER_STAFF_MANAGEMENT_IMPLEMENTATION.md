# User & Staff Management System Implementation

## Overview

A comprehensive User & Staff Management system has been implemented with proper role-based access control (RBAC) for the Shopify dashboard. The system supports a 5-level hierarchy with granular permissions and team management capabilities.

## Implementation Summary

### ✅ Completed Components

#### 1. **Backend Infrastructure**

**Configuration Files:**
- ✅ Updated `backend/config/roles.config.js` with new hierarchy:
  - `super_admin` - Full platform access
  - `store_owner` - Owns stores, manages teams
  - `manager` - Manages operations, campaigns
  - `team_member` - Limited access
  - `viewer` - Read-only access

- ✅ Updated `backend/config/permissions.config.js` with new permissions:
  - Team management permissions (invite, remove, edit role, edit permissions)
  - Activity logs viewing
  - Admin impersonation
  - Analytics viewing

**Data Schema Files:**
- ✅ `backend/data/store-teams.json` - Team members per store
- ✅ `backend/data/invitations.json` - Pending team invitations
- ✅ `backend/data/permissions.json` - Permission definitions
- ✅ Updated `backend/data/users.json` structure with:
  - `ownedStores` - Stores owned by user
  - `assignedStores` - Stores user is assigned to
  - `permissions` - Custom permission overrides
  - `invitedBy` - Who invited the user
  - `status` - User status (active, inactive, pending_invitation)
  - `lastLogin` - Last login timestamp

**Services:**
- ✅ `backend/services/teamManagementService.js` - Complete team management:
  - `inviteTeamMember()` - Send invitations with role and permissions
  - `acceptInvitation()` - Accept invitation with token
  - `removeTeamMember()` - Remove from store team
  - `updateTeamMemberRole()` - Change member role
  - `updateTeamMemberPermissions()` - Update custom permissions
  - `getStoreTeam()` - Get all team members for a store
  - `getPendingInvitations()` - Get pending invitations
  - `cancelInvitation()` - Cancel pending invitation
  - `resendInvitation()` - Resend expired invitation
  - **Subscription plan limits integration** (Basic: 2, Pro: 10, Enterprise: unlimited)

- ✅ `backend/services/permissionsService.js` - Permission checking:
  - `checkPermission()` - Check user permission for store
  - `getUserPermissions()` - Get all permissions for user in store
  - `getRolePermissions()` - Get permissions for a role
  - `canAccessStore()` - Check store access
  - `getUserStores()` - Get all accessible stores
  - `canInviteTeamMembers()` - Check invite permission
  - `canRemoveTeamMembers()` - Check remove permission

- ✅ `backend/services/activityLogService.js` - Activity logging:
  - `logActivityEntry()` - Log team management actions
  - `getActivityLogs()` - Get logs with filters (user, action, date range)
  - `getUserActivityLogs()` - Get logs for specific user
  - `getRecentActivityLogs()` - Get recent activity
  - `getActivityLogsByAction()` - Filter by action type

**API Routes:**
- ✅ `backend/routes/teamRoutes.js` - Complete REST API:
  - `GET /api/teams/:storeId` - Get store team
  - `POST /api/teams/:storeId/invite` - Invite team member
  - `GET /api/teams/invitations/pending` - Get pending invitations
  - `POST /api/teams/invitations/:token/accept` - Accept invitation
  - `DELETE /api/teams/invitations/:id` - Cancel invitation
  - `POST /api/teams/invitations/:id/resend` - Resend invitation
  - `DELETE /api/teams/:storeId/members/:userId` - Remove member
  - `PUT /api/teams/:storeId/members/:userId/role` - Update role
  - `PUT /api/teams/:storeId/members/:userId/permissions` - Update permissions
  - `GET /api/teams/:storeId/activity-logs` - Get activity logs
  - `GET /api/teams/:storeId/permissions` - Get user permissions

**Middleware:**
- ✅ Updated `backend/middleware/rbac.js`:
  - Async `requirePermission()` - Store-aware permission checking
  - Async `authorizeStoreAccess()` - Enhanced store access control
  - `requireStoreOwner()` - Store owner verification
  - Integration with new permission service

#### 2. **Frontend Components**

**Main Page:**
- ✅ `backend/shopify-dashboard/app/settings/team/page.tsx` - Team Management page:
  - Tab navigation (Team Members, Pending Invitations, Activity Logs)
  - Search and filter by role
  - Team member cards with actions
  - Real-time updates

**Components:**
- ✅ `backend/shopify-dashboard/components/team/InviteTeamMemberModal.tsx`:
  - Email input with validation
  - Role selector with descriptions
  - Custom permissions editor (grouped by category)
  - Role-based permission presets
  - Invitation preview

- ✅ `backend/shopify-dashboard/components/team/TeamMemberCard.tsx`:
  - Avatar with initials
  - Role badge with color coding
  - Permission tags (first 3 + count)
  - Last active indicator
  - Quick actions dropdown (Edit, Change Role, Remove)

- ✅ `backend/shopify-dashboard/components/team/PermissionsEditor.tsx`:
  - Grouped checkboxes by category
  - Select All / Deselect All per category
  - Role preset buttons
  - Shows inherited permissions

- ✅ `backend/shopify-dashboard/components/team/ActivityLogViewer.tsx`:
  - Timeline view of activities
  - Filters (User, Action Type, Date Range)
  - Action icons (UserPlus, UserMinus, Shield, Key, etc.)
  - Pagination
  - Export capability ready

- ✅ `backend/shopify-dashboard/components/team/PendingInvitationsTable.tsx`:
  - Table with email, role, invited by, dates
  - Countdown timer for expiry
  - Resend invitation button
  - Cancel invitation button
  - Copy invitation link button

**Pages:**
- ✅ `backend/shopify-dashboard/app/accept-invitation/page.tsx`:
  - Token-based invitation acceptance
  - Success/error states
  - Redirect to dashboard
  - User-friendly UI

**API Proxy Routes (Next.js):**
- ✅ All team management endpoints proxied to backend
- ✅ Proper authentication handling
- ✅ Error handling and status codes

#### 3. **Subscription Integration**

- ✅ Updated `backend/data/plan-features.json`:
  - Basic Plan: 2 team members per store
  - Pro Plan: 10 team members per store
  - Enterprise Plan: Unlimited team members

- ✅ Team member limit checking in `inviteTeamMember()`:
  - Validates against subscription plan
  - Throws error if limit reached
  - Clear error messages

#### 4. **Security Features**

- ✅ Invitation tokens (UUID) with 7-day expiry
- ✅ Audit logs for all team actions
- ✅ Email verification before accepting invitation
- ✅ IP address tracking in activity logs
- ✅ Permission-based access control on all endpoints
- ✅ Store access verification

### 📋 Permission Matrix

| Permission | Super Admin | Store Owner | Manager | Team Member | Viewer |
|------------|------------|-------------|---------|-------------|--------|
| Manage All Stores | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Own Stores | ✅ | ✅ | ❌ | ❌ | ❌ |
| Invite Team Members | ✅ | ✅ | ✅* | ❌ | ❌ |
| Remove Team Members | ✅ | ✅ | ✅* | ❌ | ❌ |
| Manage Subscription | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Billing | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create Campaigns | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit Campaigns | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Campaigns | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Customers | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Customers | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit Store Settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ❌ | ✅ |
| View Activity Logs | ✅ | ✅ | ✅ | ❌ | ❌ |
| Impersonate Users | ✅ | ❌ | ❌ | ❌ | ❌ |

*Manager can only invite Team Members and Viewers, not other Managers

### 🎨 UI/UX Features

- ✅ Role-based color coding:
  - Store Owner: Purple (#8B5CF6)
  - Manager: Blue (#3B82F6)
  - Team Member: Green (#10B981)
  - Viewer: Gray (#6B7280)

- ✅ Lucide React icons throughout
- ✅ Loading states for all async actions
- ✅ Success/error toasts (using Sonner)
- ✅ Confirmation modals for destructive actions
- ✅ Empty states with illustrations
- ✅ Responsive design with Tailwind CSS
- ✅ Permission badges with subtle backgrounds

### 📁 File Structure

```
backend/
├── config/
│   ├── roles.config.js (✅ Updated)
│   └── permissions.config.js (✅ Updated)
├── data/
│   ├── store-teams.json (✅ New)
│   ├── invitations.json (✅ New)
│   ├── permissions.json (✅ New)
│   ├── users.json (✅ Updated)
│   └── plan-features.json (✅ Updated)
├── services/
│   ├── teamManagementService.js (✅ New)
│   ├── permissionsService.js (✅ New)
│   └── activityLogService.js (✅ New)
├── routes/
│   └── teamRoutes.js (✅ Updated)
├── middleware/
│   └── rbac.js (✅ Updated)
└── shopify-dashboard/
    ├── app/
    │   ├── settings/team/page.tsx (✅ New)
    │   ├── accept-invitation/page.tsx (✅ New)
    │   └── api/teams/ (✅ New - All proxy routes)
    └── components/
        └── team/ (✅ New - All components)
```

### 🔄 Next Steps (Optional Enhancements)

1. **Email Notifications:**
   - Create email templates in `backend/utils/emailTemplates/`
   - Send invitation emails
   - Send notification emails (role changed, removed, etc.)

2. **Admin Panel Enhancements:**
   - Update `backend/shopify-dashboard/app/admin/users/page.tsx` to support new hierarchy
   - Add impersonation feature for super admin
   - Add user activity monitoring
   - Add force role changes

3. **Integration with Existing Features:**
   - Update navigation sidebar to show role-appropriate menu
   - Update store selector to only show accessible stores
   - Add permission checks to existing API routes
   - Update dashboard to show role-appropriate content

4. **Advanced Features:**
   - Two-factor authentication for sensitive actions
   - Real-time notifications (WebSockets)
   - Background job to clean up expired invitations
   - Export activity logs to CSV

### 🧪 Testing Checklist

- [ ] Invite team member with different roles
- [ ] Accept invitation with valid token
- [ ] Reject expired invitation
- [ ] Remove team member
- [ ] Update team member role
- [ ] Update custom permissions
- [ ] Check subscription plan limits
- [ ] View activity logs
- [ ] Cancel pending invitation
- [ ] Resend invitation
- [ ] Permission checks on all endpoints
- [ ] Store access verification

### 📝 Notes

- All file-based storage uses atomic operations via `fileStorage.js`
- Activity logs are appended to prevent data loss
- Invitation tokens are UUIDs with 7-day expiry
- Subscription plan limits are enforced at invitation time
- Permission checks are async and store-aware
- Backward compatibility maintained with existing role system

### 🚀 Usage

1. **Access Team Management:**
   - Navigate to `/settings/team`
   - Requires store owner or admin role

2. **Invite Team Member:**
   - Click "Invite Team Member" button
   - Enter email, select role, set permissions
   - Invitation link is generated and can be shared

3. **Accept Invitation:**
   - User clicks invitation link: `/accept-invitation?token=xxx`
   - Must be logged in
   - Automatically added to store team

4. **Manage Team:**
   - View all team members
   - Edit permissions per member
   - Change roles
   - Remove members
   - View activity logs

---

**Implementation Date:** January 2025  
**Status:** ✅ Core Implementation Complete  
**Next:** Optional enhancements and testing

