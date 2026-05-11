// backend/scripts/seed-subscriptions.js
import { readFileSafe, writeFileSafe } from '../utils/fileStorage.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.join(__dirname, '..'));

async function seed() {
  console.log('🌱 Seeding subscription data...');
  
  // Check if we're in production
  if (process.env.NODE_ENV === 'production') {
    console.log('❌ Cannot seed in production environment');
    process.exit(1);
  }
  
  try {
    // Load existing data
    const users = await readFileSafe('users.json', { default: { users: [] } });
    const stores = await readFileSafe('stores.json', { default: { stores: [] } });
    
    // Create sample subscriptions
    const subscriptions = [];
    const brands = [];
    const coupons = [];
    const payments = [];
    const usageMetrics = [];
    
    const now = new Date();
    const sampleUsers = users.users.slice(0, 10);
    
    // Create subscriptions for sample users
    for (let i = 0; i < sampleUsers.length; i++) {
      const user = sampleUsers[i];
      const planType = i % 3 === 0 ? 'pro' : 'basic'; // Mix of plans
      const status = i === 0 ? 'cancelled' : 'active';
      
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - (i % 6));
      
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
      
      const subscription = {
        id: `sub_${uuidv4()}`,
        userId: user.id,
        planType,
        billingCycle: 'monthly',
        status,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        price: planType === 'pro' ? 99 : 29,
        currency: 'USD',
        stripeSubscriptionId: `sub_stripe_${i}`,
        stripeCustomerId: `cus_stripe_${i}`,
        couponCode: i === 2 ? 'WELCOME10' : null,
        discountAmount: i === 2 ? 2.9 : 0,
        createdAt: startDate.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: user.id
      };
      
      subscriptions.push(subscription);
      
      // Create payment history (last 6 months)
      for (let j = 0; j < 6; j++) {
        const paymentDate = new Date(now);
        paymentDate.setMonth(paymentDate.getMonth() - j);
        
        payments.push({
          id: `pay_${uuidv4()}`,
          subscriptionId: subscription.id,
          userId: user.id,
          amount: subscription.price,
          currency: 'USD',
          type: 'subscription',
          status: j === 0 && i === 1 ? 'failed' : 'succeeded',
          paymentMethod: 'card',
          stripePaymentIntentId: `pi_${uuidv4()}`,
          stripeInvoiceId: `in_${uuidv4()}`,
          description: `Monthly subscription payment for ${planType} plan`,
          failureReason: j === 0 && i === 1 ? 'Insufficient funds' : null,
          retryCount: j === 0 && i === 1 ? 1 : 0,
          createdAt: paymentDate.toISOString(),
          updatedAt: paymentDate.toISOString()
        });
      }
      
      // Create usage metrics
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const messagesLimit = planType === 'pro' ? -1 : 1000;
      const campaignsLimit = planType === 'pro' ? -1 : 2;
      
      usageMetrics.push({
        id: `metric_${uuidv4()}`,
        storeId: stores.stores[i % stores.stores.length]?.id || `store_${i}`,
        userId: user.id,
        period: currentMonth,
        planType,
        limits: {
          messagesPerMonth: messagesLimit,
          campaignsPerMonth: campaignsLimit,
          apiCallsPerMonth: 10000
        },
        usage: {
          messagesSent: planType === 'pro' ? 0 : Math.floor(Math.random() * 1000),
          campaignsCreated: planType === 'pro' ? 0 : Math.floor(Math.random() * 2),
          apiCalls: Math.floor(Math.random() * 5000)
        },
        alertsSent: {
          at80Percent: false,
          at100Percent: false
        },
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      });
    }
    
    // Create brands for stores
    const industryTypes = ['Retail', 'Fashion', 'Electronics', 'Food & Beverage', 'Health & Beauty'];
    for (let i = 0; i < Math.min(5, stores.stores.length); i++) {
      const store = stores.stores[i];
      brands.push({
        id: `brand_${uuidv4()}`,
        storeId: store.id,
        brandName: `${store.name || 'Store'} Brand`,
        brandLogo: null,
        brandColor: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        brandSecondaryColor: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        timezone: 'America/New_York',
        industryType: industryTypes[i % industryTypes.length],
        emailSignature: `Best regards,\n${store.name || 'Store'} Team`,
        socialLinks: {
          website: `https://${store.name?.toLowerCase().replace(/\s+/g, '')}.com`,
          facebook: `https://facebook.com/${store.name?.toLowerCase().replace(/\s+/g, '')}`,
          instagram: `https://instagram.com/${store.name?.toLowerCase().replace(/\s+/g, '')}`
        },
        defaultTemplates: [],
        settings: {},
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: 'admin'
      });
    }
    
    // Create coupons
    const couponData = [
      { code: 'WELCOME10', discountType: 'percentage', value: 10, validUntil: null, usageLimit: 100 },
      { code: 'FIRST50', discountType: 'fixed', value: 50, validUntil: null, usageLimit: 50 },
      { code: 'SUMMER20', discountType: 'percentage', value: 20, validUntil: new Date(now.getFullYear(), 8, 1).toISOString(), usageLimit: null },
      { code: 'PRO50', discountType: 'fixed', value: 50, validUntil: null, usageLimit: null, applicablePlans: ['pro'] },
      { code: 'EXPIRED', discountType: 'percentage', value: 15, validUntil: new Date(2024, 0, 1).toISOString(), usageLimit: null },
      { code: 'SINGLEUSE', discountType: 'fixed', value: 25, validUntil: null, usageLimit: 1, singleUse: true },
      { code: 'BASICONLY', discountType: 'percentage', value: 30, validUntil: null, usageLimit: null, applicablePlans: ['basic'] },
      { code: 'YEARLY', discountType: 'percentage', value: 15, validUntil: null, usageLimit: null },
      { code: 'BLACKFRIDAY', discountType: 'percentage', value: 40, validUntil: new Date(now.getFullYear(), 10, 30).toISOString(), usageLimit: 200 },
      { code: 'NEWUSER', discountType: 'fixed', value: 20, validUntil: null, usageLimit: 500, singleUse: true }
    ];
    
    for (const coupon of couponData) {
      coupons.push({
        id: `coupon_${uuidv4()}`,
        code: coupon.code,
        discountType: coupon.discountType,
        value: coupon.value,
        validity: {
          validFrom: null,
          validUntil: coupon.validUntil
        },
        usageLimit: coupon.usageLimit,
        usedCount: Math.floor(Math.random() * (coupon.usageLimit || 10)),
        applicablePlans: coupon.applicablePlans || [],
        singleUse: coupon.singleUse || false,
        usedBy: [],
        status: coupon.validUntil && new Date(coupon.validUntil) < now ? 'expired' : 'active',
        description: `Discount coupon: ${coupon.code}`,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        createdBy: 'admin'
      });
    }
    
    // Write all data
    await writeFileSafe('subscriptions.json', { subscriptions });
    await writeFileSafe('brands.json', { brands });
    await writeFileSafe('coupons.json', { coupons });
    await writeFileSafe('payment-history.json', { payments });
    await writeFileSafe('usage-metrics.json', { metrics: usageMetrics });
    
    console.log('✅ Seeding complete!');
    console.log(`   - ${subscriptions.length} subscriptions`);
    console.log(`   - ${brands.length} brands`);
    console.log(`   - ${coupons.length} coupons`);
    console.log(`   - ${payments.length} payments`);
    console.log(`   - ${usageMetrics.length} usage metrics`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run seeder
seed().then(() => {
  console.log('✨ Done!');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

