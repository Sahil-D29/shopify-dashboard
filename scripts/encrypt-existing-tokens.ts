import { migrateTokensToEncrypted } from '../lib/token-manager';

async function main() {
  console.log('🔐 Starting token encryption migration...\n');
  
  try {
    const migrated = await migrateTokensToEncrypted();
    
    if (migrated > 0) {
      console.log(`\n✅ Migration completed successfully! ${migrated} tokens encrypted.`);
    } else {
      console.log('\n✅ All tokens are already encrypted.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

main();


