// backend/middleware/auth.js
import jwt from 'jsonwebtoken';
import { readFileSafe } from '../utils/safeFileStore.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersFile = path.join(process.cwd(), 'backend', 'data', 'users.json');

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }
  
  const token = header.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  
  try {
    // Try admin secret first, then regular JWT secret
    const adminSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'secret';
    const regularSecret = process.env.JWT_SECRET || 'secret';
    
    let payload;
    try {
      payload = jwt.verify(token, adminSecret);
    } catch (e) {
      payload = jwt.verify(token, regularSecret);
    }
    
    // Load users
    const usersData = await readFileSafe(usersFile, { default: { users: [] } });
    const user = usersData.users.find(
      u => u.id === payload.sub || u.email === payload.sub || u.id === payload.userId || u.email === payload.email
    );
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Optional auth - doesn't fail if no token
export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }
  
  const token = header.split(' ')[1];
  if (!token) {
    return next();
  }
  
  try {
    const adminSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || 'secret';
    const regularSecret = process.env.JWT_SECRET || 'secret';
    
    let payload;
    try {
      payload = jwt.verify(token, adminSecret);
    } catch (e) {
      payload = jwt.verify(token, regularSecret);
    }
    
    const usersData = await readFileSafe(usersFile, { default: { users: [] } });
    const user = usersData.users.find(
      u => u.id === payload.sub || u.email === payload.sub || u.id === payload.userId || u.email === payload.email
    );
    
    if (user) {
      req.user = user;
      req.tokenPayload = payload;
    }
  } catch (err) {
    // Ignore auth errors for optional auth
  }
  
  next();
}


