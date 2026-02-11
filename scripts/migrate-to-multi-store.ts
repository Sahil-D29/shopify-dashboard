/**
 * Data Migration Script: Add storeId to existing data
 * 
 * This script migrates existing data to include storeId for multi-tenant support.
 * Run this script once before enabling multi-store features.
 * 
 * Usage: npx tsx scripts/migrate-to-multi-store.ts
 */

import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_STORE_ID = 'store_default';

interface MigrationResult {
  file: string;
  itemsUpdated: number;
  success: boolean;
  error?: string;
}

async function migrateFile(
  filePath: string,
  itemKey: string,
  defaultStoreId: string
): Promise<MigrationResult> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    let itemsUpdated = 0;
    
    if (Array.isArray(data)) {
      // If data is an array
      for (const item of data) {
        if (!item.storeId) {
          item.storeId = defaultStoreId;
          itemsUpdated++;
        }
      }
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } else if (data[itemKey] && Array.isArray(data[itemKey])) {
      // If data has a key with an array
      for (const item of data[itemKey]) {
        if (!item.storeId) {
          item.storeId = defaultStoreId;
          itemsUpdated++;
        }
      }
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } else {
      return {
        file: path.basename(filePath),
        itemsUpdated: 0,
        success: false,
        error: 'Unknown data structure',
      };
    }
    
    return {
      file: path.basename(filePath),
      itemsUpdated,
      success: true,
    };
  } catch (error: any) {
    return {
      file: path.basename(filePath),
      itemsUpdated: 0,
      success: false,
      error: error.message,
    };
  }
}

async function backupFile(filePath: string): Promise<void> {
  const backupPath = `${filePath}.backup.${Date.now()}`;
  await fs.copyFile(filePath, backupPath);
  console.log(`✅ Backed up: ${path.basename(filePath)} → ${path.basename(backupPath)}`);
}

async function main() {
  console.log('🚀 Starting Multi-Store Data Migration...\n');
  
  // Files to migrate
  const filesToMigrate = [
    { path: path.join(DATA_DIR, 'journeys.json'), key: 'journeys' },
    { path: path.join(DATA_DIR, 'campaigns.json'), key: 'campaigns' },
    { path: path.join(DATA_DIR, 'segments.json'), key: 'segments' },
    { path: path.join(DATA_DIR, 'journey-enrollments.json'), key: 'enrollments' },
    { path: path.join(DATA_DIR, 'customers.json'), key: 'customers' },
    { path: path.join(DATA_DIR, 'campaign-messages.json'), key: 'messages' },
  ];
  
  const results: MigrationResult[] = [];
  
  for (const { path: filePath, key } of filesToMigrate) {
    try {
      // Check if file exists
      await fs.access(filePath);
      
      console.log(`📝 Migrating ${path.basename(filePath)}...`);
      
      // Backup file
      await backupFile(filePath);
      
      // Migrate file
      const result = await migrateFile(filePath, key, DEFAULT_STORE_ID);
      results.push(result);
      
      if (result.success) {
        console.log(`   ✅ Updated ${result.itemsUpdated} items\n`);
      } else {
        console.log(`   ❌ Error: ${result.error}\n`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`   ⚠️  File not found, skipping...\n`);
      } else {
        results.push({
          file: path.basename(filePath),
          itemsUpdated: 0,
          success: false,
          error: error.message,
        });
        console.log(`   ❌ Error: ${error.message}\n`);
      }
    }
  }
  
  // Summary
  console.log('\n📊 Migration Summary:');
  console.log('═══════════════════════════════════════');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const totalItems = results.reduce((sum, r) => sum + r.itemsUpdated, 0);
  
  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📦 Total items updated: ${totalItems}`);
  
  if (failed.length > 0) {
    console.log('\n❌ Failed migrations:');
    failed.forEach(r => {
      console.log(`   - ${r.file}: ${r.error}`);
    });
  }
  
  console.log('\n✅ Migration complete!');
  console.log('💡 Backup files created with .backup.* extension');
  console.log('💡 You can restore from backups if needed\n');
}

// Run migration
main().catch(console.error);

