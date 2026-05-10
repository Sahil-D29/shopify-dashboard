// backend/services/brandsService.js
import path from 'path';
import { readFileSafe, writeFileSafe } from '../utils/fileStorage.js';
import { v4 as uuidv4 } from 'uuid';
import { logActivity } from '../utils/logger.js';

const brandsFile = path.join(process.cwd(), 'backend', 'data', 'brands.json');

/**
 * Load all brands
 */
export async function loadBrands() {
  const data = await readFileSafe(brandsFile, { default: { brands: [] } });
  return data.brands || [];
}

/**
 * Get brand by ID
 */
export async function getBrandById(id) {
  const brands = await loadBrands();
  return brands.find(b => b.id === id);
}

/**
 * Get brands by store ID
 */
export async function getBrandsByStoreId(storeId) {
  const brands = await loadBrands();
  return brands.filter(b => b.storeId === storeId);
}

/**
 * Create brand
 */
export async function createBrand(brandData, actorId) {
  const brands = await loadBrands();
  
  const brand = {
    id: `brand_${uuidv4()}`,
    storeId: brandData.storeId,
    brandName: brandData.brandName,
    brandLogo: brandData.brandLogo || null,
    brandColor: brandData.brandColor || '#000000',
    brandSecondaryColor: brandData.brandSecondaryColor || null,
    timezone: brandData.timezone || 'UTC',
    industryType: brandData.industryType || null,
    emailSignature: brandData.emailSignature || null,
    socialLinks: brandData.socialLinks || {},
    defaultTemplates: brandData.defaultTemplates || [],
    settings: brandData.settings || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: actorId
  };
  
  brands.push(brand);
  await writeFileSafe('brands.json', { brands });
  
  await logActivity({
    actor: actorId,
    action: 'brand.created',
    resource: brand.id,
    details: { brandName: brand.brandName, storeId: brand.storeId }
  });
  
  return brand;
}

/**
 * Update brand
 */
export async function updateBrand(id, updates, actorId) {
  const brands = await loadBrands();
  const index = brands.findIndex(b => b.id === id);
  
  if (index === -1) {
    throw new Error('Brand not found');
  }
  
  const brand = {
    ...brands[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  brands[index] = brand;
  await writeFileSafe('brands.json', { brands });
  
  await logActivity({
    actor: actorId,
    action: 'brand.updated',
    resource: id,
    details: updates
  });
  
  return brand;
}

/**
 * Delete brand
 */
export async function deleteBrand(id, actorId) {
  const brands = await loadBrands();
  const initialLength = brands.length;
  const filtered = brands.filter(b => b.id !== id);
  
  if (filtered.length === initialLength) {
    throw new Error('Brand not found');
  }
  
  await writeFileSafe('brands.json', { brands: filtered });
  
  await logActivity({
    actor: actorId,
    action: 'brand.deleted',
    resource: id
  });
  
  return true;
}

