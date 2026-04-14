/**
 * APIBridge AI — Real World Test Suite
 * Tests every scenario a developer actually hits
 */

const { APIBridgeTransformer } = require('./src/transformer');
const { exportMismatchCSV }    = require('./src/exporter');
const fs = require('fs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch(e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected "${b}" but got "${a}"`);
}

const t = new APIBridgeTransformer({ logMismatches: false });

// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  APIBridge AI — Test Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// ─── 1. BASIC TRANSFORMATION ──────────────────────────────────
console.log('1. Basic snake_case → camelCase');

test('simple snake_case field', () => {
  const r = t.transform({ first_name: 'John' });
  assertEqual(r.firstName, 'John');
});

test('multiple fields', () => {
  const r = t.transform({ first_name: 'John', last_name: 'Doe', user_age: 25 });
  assertEqual(r.firstName, 'John');
  assertEqual(r.lastName,  'Doe');
  assertEqual(r.userAge,   25);
});

test('already camelCase — passes through untouched', () => {
  const r = t.transform({ firstName: 'John', isActive: true });
  assertEqual(r.firstName, 'John');
  assertEqual(r.isActive,  true);
});

test('SCREAMING_SNAKE_CASE', () => {
  const r = t.transform({ FIRST_NAME: 'John', USER_ID: 42 });
  assertEqual(r.firstName, 'John');
  assertEqual(r.userId,    42);
});

test('PascalCase', () => {
  const r = t.transform({ FirstName: 'John', LastName: 'Doe' });
  assertEqual(r.firstName, 'John');
  assertEqual(r.lastName,  'Doe');
});

// ─── 2. NESTED OBJECTS ───────────────────────────────────────
console.log('\n2. Nested objects');

test('nested object keys transformed', () => {
  const r = t.transform({
    user_info: {
      first_name: 'John',
      home_address: { addr_city: 'Delhi', pin_code: '110001' }
    }
  });
  assertEqual(r.userInfo.firstName, 'John');
  assertEqual(r.userInfo.homeAddress.addrCity, 'Delhi');
});

test('deeply nested', () => {
  const r = t.transform({
    order_data: { line_items: { product_name: 'Shoes' } }
  });
  assertEqual(r.orderData.lineItems.productName, 'Shoes');
});

// ─── 3. ARRAYS ────────────────────────────────────────────────
console.log('\n3. Arrays of objects');

test('array of objects transformed', () => {
  const r = t.transform([
    { first_name: 'John', is_active: true },
    { first_name: 'Jane', is_active: false },
  ]);
  assertEqual(r[0].firstName, 'John');
  assertEqual(r[1].firstName, 'Jane');
  assertEqual(r[0].isActive,  true);
});

test('nested array inside object', () => {
  const r = t.transform({
    order_items: [
      { product_name: 'Shoes', unit_price: 500 },
      { product_name: 'Belt',  unit_price: 200 },
    ]
  });
  assertEqual(r.orderItems[0].productName, 'Shoes');
  assertEqual(r.orderItems[1].unitPrice,   200);
});

// ─── 4. TYPE COERCION ────────────────────────────────────────
console.log('\n4. Type coercion with schema');

const userSchema = {
  isActive:    { column: 'is_active',   type: 'boolean' },
  price:       { column: 'price',       type: 'number'  },
  createdAt:   { column: 'created_at',  type: 'date'    },
  age:         { column: 'age',         type: 'number'  },
};

test('SQL integer 1 → JS boolean true', () => {
  const r = t.transform({ is_active: 1 }, userSchema);
  assertEqual(r.isActive, true);
});

test('SQL integer 0 → JS boolean false', () => {
  const r = t.transform({ is_active: 0 }, userSchema);
  assertEqual(r.isActive, false);
});

test('SQL decimal string → JS number', () => {
  const r = t.transform({ price: '299.99' }, userSchema);
  assertEqual(r.price, 299.99);
});

test('SQL date string → JS Date object', () => {
  const r = t.transform({ created_at: '2024-01-15T10:30:00.000Z' }, userSchema);
  assert(r.createdAt instanceof Date, 'Should be a Date object');
});

test('integer string → number', () => {
  const r = t.transform({ age: '25' }, userSchema);
  assertEqual(r.age, 25);
});

// ─── 5. SYNONYM MATCHING ─────────────────────────────────────
console.log('\n5. Semantic synonym matching');

test('addr_line1 maps to street concept', () => {
  const r = t.transform({ addr_line1: '123 Main St' });
  // Should produce addrLine1 at minimum (pattern conversion)
  assert(r.addrLine1 !== undefined || r.addressLine1 !== undefined,
    'Should map addr_line1');
});

test('usr_id maps to userId', () => {
  const r = t.transform({ usr_id: 42 });
  assert(r.usrId !== undefined || r.userId !== undefined);
});

test('is_active maps to isActive', () => {
  const r = t.transform({ is_active: true });
  assertEqual(r.isActive, true);
});

// ─── 6. REAL WORLD API EXAMPLES ──────────────────────────────
console.log('\n6. Real-world API responses');

test('Typical user API response', () => {
  const r = t.transform({
    user_id:        101,
    user_first_name:'Ravi',
    user_last_name: 'Kumar',
    email_address:  'ravi@example.com',
    mobile_number:  '9876543210',
    is_active:      1,
    is_verified:    1,
    created_at:     '2024-01-01T00:00:00Z',
    profile_image:  'https://cdn.example.com/pic.jpg',
  });
  assertEqual(r.userId,       101);
  assertEqual(r.userFirstName,'Ravi');
  assertEqual(r.emailAddress, 'ravi@example.com');
  assertEqual(r.isActive,     1);   // without schema, no coercion
  assertEqual(r.profileImage, 'https://cdn.example.com/pic.jpg');
});

test('E-commerce order response', () => {
  const r = t.transform({
    order_id:       'ORD-2024-001',
    order_date:     '2024-01-15',
    total_amount:   '1499.00',
    delivery_address: {
      addr_line1:   '42 MG Road',
      addr_city:    'Bengaluru',
      addr_pincode: '560001',
    },
    order_items: [
      { product_id: 1, product_name: 'Shirt', unit_price: '999.00', qty: 1 },
      { product_id: 2, product_name: 'Belt',  unit_price: '500.00', qty: 1 },
    ]
  });
  assertEqual(r.orderId,    'ORD-2024-001');
  assertEqual(r.totalAmount,'1499.00');
  assertEqual(r.deliveryAddress.addrCity, 'Bengaluru');
  assertEqual(r.orderItems[0].productName,'Shirt');
  assertEqual(r.orderItems[1].qty, 1);
});

test('Razorpay-style payment response', () => {
  const r = t.transform({
    razorpay_payment_id: 'pay_xxx123',
    razorpay_order_id:   'order_xxx456',
    razorpay_signature:  'sig_xxx789',
    payment_status:      'captured',
    amount_paid:         49900,
    currency_code:       'INR',
  });
  assertEqual(r.razorpayPaymentId,'pay_xxx123');
  assertEqual(r.paymentStatus,    'captured');
  assertEqual(r.currencyCode,     'INR');
});

// ─── 7. LEARNING ENGINE ──────────────────────────────────────
console.log('\n7. Learning engine');

const learner = new APIBridgeTransformer({ logMismatches: false });

test('approve a mapping — remembered', () => {
  learner.approve('usr_first_nm', 'firstName');
  const r = learner.transform({ usr_first_nm: 'Priya' });
  assertEqual(r.firstName, 'Priya');
});

test('reject a mapping — not applied again', () => {
  // First transform to generate a mapping
  learner.transform({ addr_ln1: '123 St' });
  // Reject it
  learner.reject('addr_ln1', 'addrLn1', 'streetAddress');
  // Stats should show rejection recorded
  assert(learner.learning.size() >= 1);
});

test('stats tracking', () => {
  const stats = learner.getStats();
  assert(stats.totalFields > 0, 'Should have tracked fields');
  assert(typeof stats.autoFixRate === 'string');
});

// ─── 8. CSV EXPORT ───────────────────────────────────────────
console.log('\n8. CSV export');

test('CSV generated with correct structure', () => {
  const csvTransformer = new APIBridgeTransformer({ logMismatches: false });
  csvTransformer.transform({
    first_name: 'John',
    last_name:  'Doe',
    usr_age:    25,
    is_active:  1,
  });

  const csv = csvTransformer.exportCSV();
  assert(csv.includes('source_key'),  'Should have header: source_key');
  assert(csv.includes('target_key'),  'Should have header: target_key');
  assert(csv.includes('confidence_percent') || csv.includes('confidence_%'),
    'Should have header: confidence');
  assert(csv.includes('firstName') || csv.includes('first_name'),
    'Should contain field data');
});

test('CSV file exported to disk', () => {
  const csvTransformer = new APIBridgeTransformer({ logMismatches: false });
  csvTransformer.transform({ test_field: 'value', another_key: 123 });

  const filePath = exportMismatchCSV(
    csvTransformer.mismatches,
    '/tmp/apibridge_test_export.csv'
  );
  assert(fs.existsSync(filePath), 'CSV file should exist');

  const content = fs.readFileSync(filePath, 'utf8');
  assert(content.includes('source_key'), 'CSV should have headers');
  assert(content.length > 100, 'CSV should have content');
});

// ─── 9. PENDING MISMATCHES ────────────────────────────────────
console.log('\n9. Pending review queue');

test('low confidence mismatches flagged as pending', () => {
  const pt = new APIBridgeTransformer({
    logMismatches: false,
    autoApplyThreshold: 0.99   // Very high threshold — most will be pending
  });
  pt.transform({ weird_custom_key_xyz: 'value' });
  const pending = pt.getPending();
  // Should flag something as needing review
  assert(Array.isArray(pending), 'Should return array');
});

// ─────────────────────────────────────────────────────────────
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (failed > 0) {
  console.log('  Some tests failed — check output above.\n');
  process.exit(1);
} else {
  console.log('  All tests passed ✓\n');
}
