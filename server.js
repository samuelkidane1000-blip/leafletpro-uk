require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const BUSINESS = {
  name: process.env.BUSINESS_NAME || 'LeafletPro UK',
  email: process.env.BUSINESS_EMAIL || 'info@leafletprouk.com',
  phone: process.env.BUSINESS_PHONE || '020 8103 5100'
};

const LONDON_ZONES = [
  {
    key: 'central',
    name: 'Central London',
    ratePerThousand: 64,
    premium: 1.18,
    response: 'Highest density and premium targeting',
    prefixes: ['EC', 'WC', 'SW1', 'SE1', 'W1', 'NW1']
  },
  {
    key: 'north',
    name: 'North London',
    ratePerThousand: 56,
    premium: 1.06,
    response: 'Strong residential response areas',
    prefixes: ['N', 'NW', 'EN']
  },
  {
    key: 'east',
    name: 'East London',
    ratePerThousand: 54,
    premium: 1.04,
    response: 'Good value urban and mixed zones',
    prefixes: ['E', 'IG', 'RM']
  },
  {
    key: 'south',
    name: 'South London',
    ratePerThousand: 53,
    premium: 1.03,
    response: 'High residential coverage routes',
    prefixes: ['SE', 'SW', 'CR', 'SM', 'KT']
  },
  {
    key: 'west',
    name: 'West London',
    ratePerThousand: 57,
    premium: 1.08,
    response: 'Affluent mixed campaign zones',
    prefixes: ['W', 'UB', 'HA', 'TW']
  },
  {
    key: 'outer',
    name: 'Outer London & commuter belt',
    ratePerThousand: 49,
    premium: 1,
    response: 'Lower-cost high-volume routes',
    prefixes: ['BR', 'DA', 'WD', 'AL', 'CM', 'SL']
  }
];

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]', 'utf8');
}

function readOrders() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(ORDERS_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (error) {
    return [];
  }
}

function saveOrders(orders) {
  ensureDataFile();
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

function getZoneFromPostcode(postcode = '') {
  const cleaned = String(postcode || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!cleaned) return LONDON_ZONES.find((zone) => zone.key === 'central');

  const exact = LONDON_ZONES.find((zone) => zone.prefixes.some((prefix) => cleaned.startsWith(prefix)));
  return exact || LONDON_ZONES.find((zone) => zone.key === 'outer');
}

function calculateQuote(input = {}) {
  const qty = Math.max(Number(input.quantity) || 1000, 1000);
  const deliveryType = input.deliveryType === 'shared' ? 'shared' : 'solus';
  const designNeeded = Boolean(input.designNeeded);
  const trackedDistribution = input.trackedDistribution !== false;
  const printIncluded = input.printIncluded !== false;
  const zone = getZoneFromPostcode(input.postcode);

  const basePerThousand = zone.ratePerThousand;
  const sharedDiscount = deliveryType === 'shared' ? 0.78 : 1;
  const printPerThousand = printIncluded ? 31 : 0;
  const designFee = designNeeded ? 145 : 0;
  const trackingFee = trackedDistribution ? Math.max(45, qty / 1000 * 1.8) : 0;
  const setupFee = qty >= 20000 ? 0 : 35;
  const priorityFee = input.priorityWindow === 'express' ? Math.max(60, qty / 1000 * 4.5) : 0;

  const distributionCost = (qty / 1000) * basePerThousand * sharedDiscount;
  const printCost = (qty / 1000) * printPerThousand;
  const subtotal = distributionCost + printCost + designFee + trackingFee + setupFee + priorityFee;
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  return {
    zoneKey: zone.key,
    zoneName: zone.name,
    zoneInsight: zone.response,
    quantity: qty,
    deliveryType,
    ratePerThousand: Number((basePerThousand * sharedDiscount).toFixed(2)),
    distributionCost: Number(distributionCost.toFixed(2)),
    printCost: Number(printCost.toFixed(2)),
    designFee: Number(designFee.toFixed(2)),
    trackingFee: Number(trackingFee.toFixed(2)),
    setupFee: Number(setupFee.toFixed(2)),
    priorityFee: Number(priorityFee.toFixed(2)),
    subtotal: Number(subtotal.toFixed(2)),
    vat: Number(vat.toFixed(2)),
    total: Number(total.toFixed(2)),
    estimatedHomes: Math.round(qty / 1.08),
    estimatedDays: qty <= 10000 ? '2–4 days' : qty <= 50000 ? '4–7 days' : '7–12 days'
  };
}

function makeOrder(body = {}) {
  const quote = calculateQuote(body);
  return {
    id: `LP-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'New lead',
    paymentStatus: 'Pending',
    bookingSource: body.bookingSource || 'website',
    customerName: body.customerName || '',
    companyName: body.companyName || '',
    email: body.email || '',
    phone: body.phone || '',
    postcode: (body.postcode || '').toUpperCase(),
    quantity: quote.quantity,
    deliveryType: quote.deliveryType,
    priorityWindow: body.priorityWindow === 'express' ? 'express' : 'standard',
    trackedDistribution: body.trackedDistribution !== false,
    printIncluded: body.printIncluded !== false,
    designNeeded: Boolean(body.designNeeded),
    preferredStart: body.preferredStart || '',
    notes: body.notes || '',
    stripeSessionId: '',
    stripePaymentIntentId: '',
    ...quote
  };
}

function updateOrderById(orderId, updater) {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;
  const updated = typeof updater === 'function' ? updater(orders[index]) : { ...orders[index], ...updater };
  orders[index] = { ...updated, updatedAt: new Date().toISOString() };
  saveOrders(orders);
  return orders[index];
}

function adminAuth(req, res, next) {
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD || 'change-this-password';
  const header = req.headers.authorization || '';

  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="LeafletPro Admin"');
    return res.status(401).send('Authentication required');
  }

  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  const user = decoded.slice(0, separatorIndex);
  const pass = decoded.slice(separatorIndex + 1);

  if (user !== expectedUser || pass !== expectedPass) {
    res.set('WWW-Authenticate', 'Basic realm="LeafletPro Admin"');
    return res.status(401).send('Invalid admin credentials');
  }

  next();
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', adminAuth, express.static(path.join(__dirname, 'admin')));

app.get('/api/config', (req, res) => {
  res.json({
    business: BUSINESS,
    stripePublicKey: process.env.STRIPE_PUBLIC_KEY || '',
    zones: LONDON_ZONES.map((zone) => ({
      key: zone.key,
      name: zone.name,
      ratePerThousand: zone.ratePerThousand,
      response: zone.response,
      prefixes: zone.prefixes
    }))
  });
});

app.post('/api/quote', (req, res) => {
  const quote = calculateQuote(req.body || {});
  res.json(quote);
});

app.get('/api/orders', adminAuth, (req, res) => {
  const orders = readOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(orders);
});

app.post('/api/orders', (req, res) => {
  const order = makeOrder(req.body || {});
  const orders = readOrders();
  orders.push(order);
  saveOrders(orders);
  res.status(201).json(order);
});

app.patch('/api/orders/:id', adminAuth, (req, res) => {
  const allowedFields = [
    'status',
    'paymentStatus',
    'notes',
    'preferredStart',
    'customerName',
    'companyName',
    'email',
    'phone'
  ];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowedFields.includes(key)));
  const order = updateOrderById(req.params.id, patch);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PUBLIC_KEY in your .env file.' });
    }

    const body = req.body || {};
    const order = makeOrder({ ...body, bookingSource: 'stripe_checkout' });
    const orders = readOrders();
    orders.push(order);
    saveOrders(orders);

    const origin = body.origin || `http://localhost:${PORT}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: order.email || undefined,
      metadata: {
        orderId: order.id,
        postcode: order.postcode,
        quantity: String(order.quantity)
      },
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `${BUSINESS.name} campaign booking`,
              description: `${order.zoneName} · ${order.quantity.toLocaleString()} leaflets · ${order.deliveryType}`
            },
            unit_amount: Math.round(order.total * 100)
          },
          quantity: 1
        }
      ],
      success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel.html?order_id=${order.id}`
    });

    updateOrderById(order.id, {
      stripeSessionId: session.id,
      status: 'Awaiting payment'
    });

    res.json({ url: session.url, orderId: order.id });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create Stripe checkout session' });
  }
});

app.get('/api/checkout-session/:sessionId', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(400).json({ error: 'Stripe is not configured yet.' });
    }
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const orderId = session.metadata?.orderId || '';
    let order = null;

    if (orderId) {
      order = updateOrderById(orderId, (existing) => ({
        ...existing,
        paymentStatus: session.payment_status === 'paid' ? 'Paid' : existing.paymentStatus,
        status: session.payment_status === 'paid' ? 'Booked' : existing.status,
        stripeSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : existing.stripePaymentIntentId
      }));
    }

    res.json({
      orderId,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email || session.customer_email || '',
      amountTotal: session.amount_total ? session.amount_total / 100 : 0,
      order
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to verify Stripe session' });
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`${BUSINESS.name} is running on http://localhost:${PORT}`);
});
