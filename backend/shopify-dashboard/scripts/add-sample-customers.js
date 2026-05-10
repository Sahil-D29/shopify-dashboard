const fs = require('fs');
const path = require('path');

// Sample customer data matching the expected structure
const sampleCustomers = [
  {
    id: 'cust_1',
    email: 'priya@gmail.com',
    firstName: 'Priya',
    lastName: 'Sharma',
    phone: '+91 98765 43210',
    totalSpent: 22.50,
    total_spent: '22.50', // Also include snake_case for compatibility
    ordersCount: 5,
    orders_count: 5,
    tags: ['VIP', 'Returning'],
    createdAt: '2024-08-15T10:00:00Z',
    lastOrderDate: '2024-11-28T14:30:00Z',
  },
  {
    id: 'cust_2',
    email: 'anita@gmail.com',
    firstName: 'Anita',
    lastName: 'Patel',
    phone: '+91 98765 43211',
    totalSpent: 32.00,
    total_spent: '32.00',
    ordersCount: 3,
    orders_count: 3,
    tags: ['Returning'],
    createdAt: '2024-09-20T11:30:00Z',
    lastOrderDate: '2024-11-29T09:15:00Z',
  },
  {
    id: 'cust_3',
    email: 'rajesh@gmail.com',
    firstName: 'Rajesh',
    lastName: 'Kumar',
    phone: '+91 98765 43212',
    totalSpent: 45.00,
    total_spent: '45.00',
    ordersCount: 1,
    orders_count: 1,
    tags: ['New'],
    createdAt: '2024-11-25T14:20:00Z',
    lastOrderDate: '2024-11-25T14:20:00Z',
  },
  {
    id: 'cust_4',
    email: 'neha@gmail.com',
    firstName: 'Neha',
    lastName: 'Reddy',
    phone: '+91 98765 43213',
    totalSpent: 18.50,
    total_spent: '18.50',
    ordersCount: 2,
    orders_count: 2,
    tags: ['Regular'],
    createdAt: '2024-10-10T15:00:00Z',
    lastOrderDate: '2024-11-20T11:00:00Z',
  },
  {
    id: 'cust_5',
    email: 'john@yahoo.com',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+91 98765 43214',
    totalSpent: 15.00,
    total_spent: '15.00',
    ordersCount: 1,
    orders_count: 1,
    tags: ['New'],
    createdAt: '2024-11-30T10:00:00Z',
    lastOrderDate: '2024-11-30T10:00:00Z',
  },
];

const dataDir = path.join(process.cwd(), 'data');
const customersFile = path.join(dataDir, 'customers.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Read existing customers
let existingCustomers = [];
if (fs.existsSync(customersFile)) {
  try {
    const content = fs.readFileSync(customersFile, 'utf-8');
    existingCustomers = JSON.parse(content);
    if (!Array.isArray(existingCustomers)) {
      existingCustomers = [];
    }
  } catch (error) {
    console.warn('Error reading existing customers, starting fresh:', error.message);
    existingCustomers = [];
  }
}

// Add sample customers (skip if already exists)
sampleCustomers.forEach(sample => {
  const exists = existingCustomers.some(c => c.id === sample.id || c.email === sample.email);
  if (!exists) {
    existingCustomers.push(sample);
    console.log(`✅ Added customer: ${sample.email}`);
  } else {
    console.log(`⏭️  Skipped existing customer: ${sample.email}`);
  }
});

// Write to file
fs.writeFileSync(customersFile, JSON.stringify(existingCustomers, null, 2), 'utf-8');

console.log(`\n✅ Sample customers added!`);
console.log(`📊 Total customers: ${existingCustomers.length}`);
console.log(`📁 File: ${customersFile}`);
console.log(`\n💰 Expected segment totals:`);
console.log(`   - All customers: ${existingCustomers.length} customers, ₹${existingCustomers.reduce((sum, c) => sum + (parseFloat(c.totalSpent) || 0), 0).toFixed(2)}`);
console.log(`   - Gmail users: ${existingCustomers.filter(c => c.email.includes('gmail.com')).length} customers, ₹${existingCustomers.filter(c => c.email.includes('gmail.com')).reduce((sum, c) => sum + (parseFloat(c.totalSpent) || 0), 0).toFixed(2)}`);




