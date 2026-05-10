// backend/services/couponsService.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/fileStorage.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

const couponsFile = path.join(process.cwd(), 'backend', 'data', 'coupons.json');

/**
 * Load all coupons
 */
export async function loadCoupons() {
  const data = await readFileSafe(couponsFile, { default: { coupons: [] } });
  return data.coupons || [];
}

/**
 * Get coupon by code
 */
export async function getCouponByCode(code) {
  const coupons = await loadCoupons();
  return coupons.find(c => c.code.toLowerCase() === code.toLowerCase());
}

/**
 * Get coupon by ID
 */
export async function getCouponById(id) {
  const coupons = await loadCoupons();
  return coupons.find(c => c.id === id);
}

/**
 * Get active coupons
 */
export async function getActiveCoupons() {
  const coupons = await loadCoupons();
  const now = new Date();
  
  return coupons.filter(c => {
    if (c.status !== 'active') return false;
    
    const validFrom = c.validFrom ? new Date(c.validFrom) : null;
    const validUntil = c.validUntil ? new Date(c.validUntil) : null;
    
    if (validFrom && now < validFrom) return false;
    if (validUntil && now > validUntil) return false;
    
    return true;
  });
}

/**
 * Create coupon
 */
export async function createCoupon(couponData, actorId) {
  const coupons = await loadCoupons();
  
  // Check if code already exists
  const existing = await getCouponByCode(couponData.code);
  if (existing) {
    throw new Error('Coupon code already exists');
  }
  
  // Validate discount value
  if (couponData.discountType === 'percentage') {
    if (couponData.value < 0 || couponData.value > 100) {
      throw new Error('Percentage discount must be between 0 and 100');
    }
  } else if (couponData.discountType === 'fixed') {
    if (couponData.value < 0) {
      throw new Error('Fixed discount must be positive');
    }
  }
  
  const coupon = {
    id: `coupon_${uuidv4()}`,
    code: couponData.code.toUpperCase(),
    discountType: couponData.discountType, // 'percentage' or 'fixed'
    value: couponData.value,
    validity: {
      validFrom: couponData.validFrom || null,
      validUntil: couponData.validUntil || null
    },
    usageLimit: couponData.usageLimit || null, // null = unlimited
    usedCount: 0,
    applicablePlans: couponData.applicablePlans || [], // ['basic', 'pro'] or [] for all
    singleUse: couponData.singleUse || false,
    usedBy: [], // Array of user IDs who used this coupon
    status: couponData.status || 'active',
    description: couponData.description || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actorId
  };
  
  coupons.push(coupon);
  await writeFileSafe('coupons.json', { coupons });
  
  await logActivity({
    actor: actorId,
    action: 'coupon.created',
    resource: coupon.id,
    details: { code: coupon.code, discountType: coupon.discountType, value: coupon.value }
  });
  
  return coupon;
}

/**
 * Validate coupon code
 */
export async function validateCoupon(code, userId, planType) {
  const coupon = await getCouponByCode(code);
  
  if (!coupon) {
    return { valid: false, error: 'Invalid coupon code' };
  }
  
  if (coupon.status !== 'active') {
    return { valid: false, error: 'Coupon is not active' };
  }
  
  // Check validity dates
  const now = new Date();
  if (coupon.validity.validFrom) {
    const validFrom = new Date(coupon.validity.validFrom);
    if (now < validFrom) {
      return { valid: false, error: 'Coupon is not yet valid' };
    }
  }
  
  if (coupon.validity.validUntil) {
    const validUntil = new Date(coupon.validity.validUntil);
    if (now > validUntil) {
      return { valid: false, error: 'Coupon has expired' };
    }
  }
  
  // Check usage limit
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, error: 'Coupon usage limit reached' };
  }
  
  // Check if single-use and already used by this user
  if (coupon.singleUse && coupon.usedBy.includes(userId)) {
    return { valid: false, error: 'Coupon has already been used' };
  }
  
  // Check if applicable to plan
  if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(planType)) {
    return { valid: false, error: 'Coupon is not applicable to this plan' };
  }
  
  return { valid: true, coupon };
}

/**
 * Apply coupon (increment usage)
 */
export async function applyCoupon(code, userId, actorId) {
  const coupons = await loadCoupons();
  const index = coupons.findIndex(c => c.code.toLowerCase() === code.toLowerCase());
  
  if (index === -1) {
    throw new Error('Coupon not found');
  }
  
  const coupon = coupons[index];
  
  // Increment usage count
  coupon.usedCount += 1;
  
  // Add user to usedBy if single-use
  if (coupon.singleUse && !coupon.usedBy.includes(userId)) {
    coupon.usedBy.push(userId);
  }
  
  coupon.updatedAt = new Date().toISOString();
  coupons[index] = coupon;
  
  await writeFileSafe('coupons.json', { coupons });
  
  await logActivity({
    actor: actorId,
    action: 'coupon.applied',
    resource: coupon.id,
    details: { code: coupon.code, userId }
  });
  
  return coupon;
}

/**
 * Update coupon
 */
export async function updateCoupon(id, updates, actorId) {
  const coupons = await loadCoupons();
  const index = coupons.findIndex(c => c.id === id);
  
  if (index === -1) {
    throw new Error('Coupon not found');
  }
  
  const coupon = {
    ...coupons[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  coupons[index] = coupon;
  await writeFileSafe('coupons.json', { coupons });
  
  await logActivity({
    actor: actorId,
    action: 'coupon.updated',
    resource: id,
    details: updates
  });
  
  return coupon;
}

/**
 * Delete coupon
 */
export async function deleteCoupon(id, actorId) {
  const coupons = await loadCoupons();
  const initialLength = coupons.length;
  const filtered = coupons.filter(c => c.id !== id);
  
  if (filtered.length === initialLength) {
    throw new Error('Coupon not found');
  }
  
  await writeFileSafe('coupons.json', { coupons: filtered });
  
  await logActivity({
    actor: actorId,
    action: 'coupon.deleted',
    resource: id
  });
  
  return true;
}

