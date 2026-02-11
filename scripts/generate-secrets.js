const crypto = require('crypto');

console.log('\n🔐 Generated Secrets (add to .env.local):');
console.log('==========================================\n');

const encryptionKey = crypto.randomBytes(32).toString('hex');
const nextAuthSecret = crypto.randomBytes(32).toString('hex');
const adminJwtSecret = crypto.randomBytes(32).toString('hex');

console.log('ENCRYPTION_KEY=' + encryptionKey);
console.log('NEXTAUTH_SECRET=' + nextAuthSecret);
console.log('ADMIN_JWT_SECRET=' + adminJwtSecret);

console.log('\n⚠️  IMPORTANT:');
console.log('   - Keep these secrets safe and never commit them to git!');
console.log('   - Copy these values to your .env.local file');
console.log('   - Each secret should be unique');
console.log('   - Restart your server after adding them\n');


