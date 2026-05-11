// backend/routes/teamRoutes.js
// Team management routes with new hierarchy system

import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeStoreAccess, requirePermission } from '../middleware/rbac.js';
import * as teamService from '../services/teamManagementService.js';
import * as permissionsService from '../services/permissionsService.js';
import * as activityService from '../services/activityLogService.js';
import { ROLES } from '../config/roles.config.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/teams/:storeId - Get all team members for a store
 */
router.get('/:storeId', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const team = await teamService.getStoreTeam(storeId);
    
    res.json({
      success: true,
      team
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teams/:storeId/invite - Invite new team member
 */
router.post('/:storeId/invite', authorizeStoreAccess(), requirePermission('team.invite'), async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { email, role, permissions } = req.body;
    const userId = req.user.id;
    
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email and role are required'
      });
    }
    
    // Check if user can invite
    const canInvite = await permissionsService.canInviteTeamMembers(userId, storeId);
    if (!canInvite) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to invite team members'
      });
    }
    
    const result = await teamService.inviteTeamMember(storeId, email, role, permissions, userId);
    
    res.status(201).json({
      success: true,
      message: 'Invitation sent successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teams/invitations/pending - Get pending invitations for store
 */
router.get('/invitations/pending', authorizeStoreAccess(), requirePermission('team.view'), async (req, res, next) => {
  try {
    const storeId = req.query.storeId || req.params.storeId;
    
    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'Store ID is required'
      });
    }
    
    const invitations = await teamService.getPendingInvitations(storeId);
    
    res.json({
      success: true,
      invitations
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teams/invitations/:token/accept - Accept invitation
 */
router.post('/invitations/:token/accept', authenticate, async (req, res, next) => {
  try {
    const { token } = req.params;
    const userId = req.user.id;
    
    const result = await teamService.acceptInvitation(token, userId);
    
    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/teams/invitations/:id - Cancel invitation
 */
router.delete('/invitations/:id', authorizeStoreAccess(), requirePermission('team.invite'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await teamService.cancelInvitation(id, userId);
    
    res.json({
      success: true,
      message: 'Invitation cancelled successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/teams/invitations/:id/resend - Resend invitation
 */
router.post('/invitations/:id/resend', authorizeStoreAccess(), requirePermission('team.invite'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const result = await teamService.resendInvitation(id, userId);
    
    res.json({
      success: true,
      message: 'Invitation resent successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/teams/:storeId/members/:userId - Remove team member
 */
router.delete('/:storeId/members/:userId', authorizeStoreAccess(), requirePermission('team.remove'), async (req, res, next) => {
  try {
    const { storeId, userId } = req.params;
    const removedBy = req.user.id;
    
    // Check if user can remove
    const canRemove = await permissionsService.canRemoveTeamMembers(removedBy, storeId);
    if (!canRemove) {
      return res.status(403).json({
        success: false,
        error: 'You do not have permission to remove team members'
      });
    }
    
    const result = await teamService.removeTeamMember(storeId, userId, removedBy);
    
    res.json({
      success: true,
      message: 'Team member removed successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/teams/:storeId/members/:userId/role - Update member role
 */
router.put('/:storeId/members/:userId/role', authorizeStoreAccess(), requirePermission('team.edit.role'), async (req, res, next) => {
  try {
    const { storeId, userId } = req.params;
    const { role } = req.body;
    const updatedBy = req.user.id;
    
    if (!role) {
      return res.status(400).json({
        success: false,
        error: 'Role is required'
      });
    }
    
    const result = await teamService.updateTeamMemberRole(storeId, userId, role, updatedBy);
    
    res.json({
      success: true,
      message: 'Role updated successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/teams/:storeId/members/:userId/permissions - Update custom permissions
 */
router.put('/:storeId/members/:userId/permissions', authorizeStoreAccess(), requirePermission('team.edit.permissions'), async (req, res, next) => {
  try {
    const { storeId, userId } = req.params;
    const { permissions } = req.body;
    const updatedBy = req.user.id;
    
    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissions array is required'
      });
    }
    
    const result = await teamService.updateTeamMemberPermissions(storeId, userId, permissions, updatedBy);
    
    res.json({
      success: true,
      message: 'Permissions updated successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teams/:storeId/activity-logs - Get activity logs
 */
router.get('/:storeId/activity-logs', authorizeStoreAccess(), requirePermission('activity_logs.view'), async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const { page, limit, userId, action, startDate, endDate } = req.query;
    
    const filters = {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
      userId,
      action,
      startDate,
      endDate
    };
    
    const result = await activityService.getActivityLogs(storeId, filters);
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/teams/:storeId/permissions - Get user permissions for store
 */
router.get('/:storeId/permissions', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const { storeId } = req.params;
    const userId = req.user.id;
    
    const permissions = await permissionsService.getUserPermissions(userId, storeId);
    const canAccess = await permissionsService.canAccessStore(userId, storeId);
    
    res.json({
      success: true,
      permissions,
      canAccess
    });
  } catch (error) {
    next(error);
  }
});

export default router;
