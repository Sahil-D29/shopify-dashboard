/**
 * Seed subscription plans into PlanFeature table.
 * Run: npx tsx scripts/seed-plans.ts
 */
import 'dotenv/config';
import { prisma } from '../lib/prisma';

const plans = [
  {
    planId: 'starter',
    name: 'Starter',
    price: 24.00,         // USD
    priceINR: 2000.00,    // INR ₹2,000
    billingCycle: 'monthly',
    messagesPerMonth: 5000,
    campaignsPerMonth: 10,
    stores: 1,
    teamMembersPerStore: 3,
    analytics: 'basic',
    support: 'email',
    whatsappAutomation: true,
    customTemplates: true,
    advancedSegmentation: false,
  },
  {
    planId: 'growth',
    name: 'Growth',
    price: 60.00,         // USD
    priceINR: 5000.00,    // INR ₹5,000
    billingCycle: 'monthly',
    messagesPerMonth: 25000,
    campaignsPerMonth: -1, // unlimited
    stores: 3,
    teamMembersPerStore: 10,
    analytics: 'advanced',
    support: 'priority',
    whatsappAutomation: true,
    customTemplates: true,
    advancedSegmentation: true,
  },
];

async function seed() {
  console.log('Seeding plans...');

  for (const plan of plans) {
    await prisma.planFeature.upsert({
      where: { planId: plan.planId },
      create: plan,
      update: plan,
    });
    console.log(`  ✓ ${plan.name}: ₹${plan.priceINR} / $${plan.price}`);
  }

  console.log('Done! Plans seeded successfully.');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
