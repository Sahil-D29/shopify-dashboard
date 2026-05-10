// backend/routes/adminRoutes.js
import express from 'express';
import path from 'path';
import { authenticate } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { readFileSafe } from '../utils/safeFileStore.js';
import { logActivity } from '../utils/logger.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['admin']));

// GET /api/admin/users - List all users
router.get('/users', async (req, res, next) => {
  try {
    const usersFile = path.join(process.cwd(), 'backend', 'data', 'users.json');
    const data = await readFileSafe(usersFile, { default: { users: [] } });
    res.json({ users: data.users });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/logs/activity - Get activity logs
router.get('/logs/activity', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const file = path.join(process.cwd(), 'backend', 'data', 'activity-logs.json');
    const data = await readFileSafe(file, { default: [] });
    
    const logs = Array.isArray(data) ? data : (data.items || []);
    const sorted = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ logs: sorted.slice(0, limit) });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/logs/errors - Get error logs
router.get('/logs/errors', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const file = path.join(process.cwd(), 'backend', 'data', 'error-logs.json');
    const data = await readFileSafe(file, { default: [] });
    
    const logs = Array.isArray(data) ? data : (data.items || []);
    const sorted = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ logs: sorted.slice(0, limit) });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/users/:id - Get user by ID
router.get('/users/:id', async (req, res, next) => {
  try {
    const usersFile = path.join(process.cwd(), 'backend', 'data', 'users.json');
    const data = await readFileSafe(usersFile, { default: { users: [] } });
    const user = data.users.find(u => u.id === req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ user });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/payments - Get all payments
router.get('/payments', async (req, res, next) => {
  try {
    const paymentsFile = path.join(process.cwd(), 'backend', 'data', 'payment-history.json');
    const data = await readFileSafe(paymentsFile, { default: { payments: [] } });
    res.json({ payments: data.payments || [] });
  } catch (e) {
    next(e);
  }
});

// GET /api/admin/stats - Get system statistics
router.get('/stats', async (req, res, next) => {
  try {
    const segmentsFile = path.join(process.cwd(), 'backend', 'data', 'segments.json');
    const campaignsFile = path.join(process.cwd(), 'backend', 'data', 'campaigns.json');
    const journeysFile = path.join(process.cwd(), 'backend', 'data', 'journeys.json');
    const usersFile = path.join(process.cwd(), 'backend', 'data', 'users.json');
    
    const segments = await readFileSafe(segmentsFile, { default: { segments: [] } });
    const campaigns = await readFileSafe(campaignsFile, { default: { campaigns: [] } });
    const journeys = await readFileSafe(journeysFile, { default: { journeys: [] } });
    const users = await readFileSafe(usersFile, { default: { users: [] } });
    
    res.json({
      segments: segments.segments?.length || 0,
      campaigns: campaigns.campaigns?.length || 0,
      journeys: journeys.journeys?.length || 0,
      users: users.users?.length || 0
    });
  } catch (e) {
    next(e);
  }
});

export default router;

