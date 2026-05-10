// backend/routes/campaignsRoutes.js
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { authorizeStoreAccess, filterDataByStoreAccess } from '../middleware/rbac.js';
import { checkPermission } from '../middleware/granularPermissions.js';
import { ROLES } from '../config/roles.config.js';
import * as campaignsService from '../services/campaignsService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/campaigns - List campaigns
// ADMIN: All campaigns, STORE_OWNER/USER: Own store campaigns only
// USER: Requires campaigns:view permission
router.get('/', 
  authorizeStoreAccess(), 
  checkPermission('campaigns', 'view'),
  async (req, res, next) => {
  try {
    const user = req.user;
    const storeId = req.storeId || req.query.storeId || req.query.shop;
    let campaigns;
    
    if (user.role === ROLES.ADMIN) {
      // Admin sees all campaigns
      if (storeId) {
        campaigns = await campaignsService.getCampaignsByStore(storeId);
      } else {
        campaigns = await campaignsService.loadCampaigns();
      }
    } else {
      // Store owner and user see only their store's campaigns
      if (!storeId) {
        return res.status(400).json({ error: 'Store identifier required' });
      }
      campaigns = await campaignsService.getCampaignsByStore(storeId);
      // Filter to ensure user only sees their store's data
      campaigns = filterDataByStoreAccess(user, campaigns, 'storeId');
    }
    
    res.json({ campaigns });
  } catch (e) {
    next(e);
  }
});

// GET /api/campaigns/:id - Get campaign by ID
// ADMIN: Any campaign, STORE_OWNER/USER: Own store campaigns only
router.get('/:id', authorizeStoreAccess(), async (req, res, next) => {
  try {
    const user = req.user;
    const campaign = await campaignsService.getCampaignById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Check store access (admin bypasses this check)
    if (user.role !== ROLES.ADMIN && !filterDataByStoreAccess(user, [campaign], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this campaign' });
    }
    
    res.json(campaign);
  } catch (e) {
    next(e);
  }
});

// GET /api/campaigns/:id/logs - Get campaign logs
router.get('/:id/logs', async (req, res, next) => {
  try {
    const logs = await campaignsService.getCampaignLogs(req.params.id);
    res.json({ logs });
  } catch (e) {
    next(e);
  }
});

// POST /api/campaigns - Create campaign
// ADMIN: All stores, STORE_OWNER: Own store, USER: Requires campaigns:create permission
router.post('/', 
  authorizeStoreAccess(), 
  checkPermission('campaigns', 'create'),
  async (req, res, next) => {
  try {
    const user = req.user;
    
    // Ensure storeId is set for non-admin users
    if (user.role !== 'admin' && !req.storeId) {
      req.storeId = req.body.storeId || req.body.shop;
    }
    
    const campaignData = {
      ...req.body,
      storeId: req.storeId || req.body.storeId || req.body.shop,
      createdBy: user.id
    };
    
    const campaign = await campaignsService.createCampaign(campaignData, user.id);
    res.status(201).json(campaign);
  } catch (e) {
    next(e);
  }
});

// PUT /api/campaigns/:id - Update campaign
// ADMIN: Any campaign, STORE_OWNER: Own store, USER: Requires campaigns:edit permission
router.put('/:id', 
  authorizeStoreAccess(), 
  checkPermission('campaigns', 'edit'),
  async (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if campaign exists and user has access
    const existingCampaign = await campaignsService.getCampaignById(req.params.id);
    if (!existingCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Check store access (admin bypasses)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [existingCampaign], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this campaign' });
    }
    
    const campaign = await campaignsService.updateCampaign(req.params.id, req.body, user.id);
    res.json(campaign);
  } catch (e) {
    if (e.message === 'Campaign not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

// DELETE /api/campaigns/:id - Delete campaign
// ADMIN: Any campaign, STORE_OWNER: Own store, USER: Requires campaigns:delete permission
router.delete('/:id', 
  authorizeStoreAccess(), 
  checkPermission('campaigns', 'delete'),
  async (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if campaign exists and user has access
    const existingCampaign = await campaignsService.getCampaignById(req.params.id);
    if (!existingCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Check store access (admin bypasses)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [existingCampaign], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this campaign' });
    }
    
    await campaignsService.deleteCampaign(req.params.id, user.id);
    res.json({ success: true });
  } catch (e) {
    if (e.message === 'Campaign not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

// POST /api/campaigns/:id/publish - Publish campaign
// ADMIN: Any campaign, STORE_OWNER: Own store, USER: Requires campaigns:publish permission
router.post('/:id/publish', 
  authorizeStoreAccess(), 
  checkPermission('campaigns', 'publish'),
  async (req, res, next) => {
  try {
    const user = req.user;
    
    // Check if campaign exists and user has access
    const existingCampaign = await campaignsService.getCampaignById(req.params.id);
    if (!existingCampaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    // Check store access (admin bypasses)
    if (user.role !== 'admin' && !filterDataByStoreAccess(user, [existingCampaign], 'storeId').length) {
      return res.status(403).json({ error: 'Access denied to this campaign' });
    }
    
    const campaign = await campaignsService.updateCampaign(req.params.id, { 
      ...req.body, 
      status: 'published',
      publishedAt: new Date().toISOString()
    }, user.id);
    res.json({ success: true, campaign });
  } catch (e) {
    if (e.message === 'Campaign not found') {
      return res.status(404).json({ error: e.message });
    }
    next(e);
  }
});

export default router;

