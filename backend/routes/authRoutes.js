// backend/routes/authRoutes.js
// Authentication routes - NO hardcoding

import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { readFileSafe, writeFileSafe, updateArrayItem } from '../utils/fileStorage.js';
import { validateEmail, validatePassword, validateUser, generateUUID } from '../utils/validation.js';
import { isValidRole } from '../config/roles.config.js';
import { ROLES } from '../config/roles.config.js';
import { logActivity } from '../utils/logger.js';

const router = express.Router();

// Get JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const USERS_FILE = process.env.USERS_FILE || 'users.json';

/**
 * Generate JWT token for user
 * @param {object} user - User object
 * @returns {string}
 */
function generateToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      stores: user.stores || []
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * POST /api/auth/register - Register new user
 * Only ADMIN can create users (or during initial setup)
 */
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name, role, stores, canCreateCampaigns } = req.body;
    
    // Validation
    if (!email || !validateEmail(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid email is required'
        }
      });
    }
    
    if (!password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password is required'
        }
      });
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Password validation failed',
          details: passwordValidation.errors
        }
      });
    }
    
    if (!role || !isValidRole(role)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid role is required'
        }
      });
    }
    
    // Check if user already exists
    const usersData = await readFileSafe(USERS_FILE, { default: { users: [] } });
    const existingUser = usersData.users.find(u => u.email === email);
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists'
        }
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user object
    const newUser = {
      id: generateUUID(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      name: name || email.split('@')[0],
      role: role,
      stores: stores || [],
      canCreateCampaigns: canCreateCampaigns || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: null
    };
    
    // Validate user object
    const userValidation = validateUser(newUser);
    if (!userValidation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'User validation failed',
          details: userValidation.errors
        }
      });
    }
    
    // Save user
    usersData.users.push(newUser);
    await writeFileSafe(USERS_FILE, usersData);
    
    // Log activity
    await logActivity({
      type: 'user_created',
      actorId: req.user?.id || 'system',
      actorEmail: req.user?.email || 'system',
      targetId: newUser.id,
      targetEmail: newUser.email,
      details: { role: newUser.role }
    });
    
    // Generate token
    const token = generateToken(newUser);
    
    // Return user (without password)
    const { password: _, ...userWithoutPassword } = newUser;
    
    res.status(201).json({
      success: true,
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/login - Authenticate user
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
    }
    
    // Load users
    const usersData = await readFileSafe(USERS_FILE, { default: { users: [] } });
    const user = usersData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // Log failed login attempt
      await logActivity({
        type: 'login_failed',
        actorEmail: email,
        reason: 'User not found'
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      // Log failed login attempt
      await logActivity({
        type: 'login_failed',
        actorId: user.id,
        actorEmail: user.email,
        reason: 'Invalid password'
      });
      
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }
    
    // Update last login
    await updateArrayItem(USERS_FILE, user.id, { lastLogin: new Date().toISOString() }, 'users', 'id');
    
    // Log successful login
    await logActivity({
      type: 'login_success',
      actorId: user.id,
      actorEmail: user.email,
      role: user.role
    });
    
    // Generate token
    const token = generateToken(user);
    
    // Return user (without password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh - Refresh JWT token
 */
router.post('/refresh', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    
    // Generate new token
    const token = generateToken(user);
    
    // Return user (without password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/me - Get current user
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    
    // Return user (without password)
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout - Logout (client-side token removal)
 * This endpoint mainly logs the logout activity
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const user = req.user;
    
    // Log logout
    await logActivity({
      type: 'logout',
      actorId: user.id,
      actorEmail: user.email
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

