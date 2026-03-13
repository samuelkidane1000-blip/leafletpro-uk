const money = (value) => `£${Number(value || 0).toFixed(2)}`;
const footerYear = document.getElementById('footerYear');
if (footerYear) footerYear.textContent = `© ${new Date().getFullYear()}`;

const zoneShapes = {
  central: [[51.533, -0.19], [51.533, -0.005], [51.47, -0.005], [51.47, -0.19]],
  north: [[51.635, -0.31], [51.635, 0.06], [51.533, 0.06], [51.533, -0.31]],
  east: [[51.533, -0.005], [51.533, 0.23], [51.44, 0.23], [51.44, -0.005]],
  south: [[51.47, -0.28], [51.47, 0.09], [51.31, 0.09], [51.31, -0.28]],
  west: [[51.56, -0.49], [51.56, -0.19], [51.43, -0.19], [51.43, -0.49]],
  outer: [[51.72, -0.56], [51.72, 0.3], [51.24, 0.3], [51.24, -0.56]]
};
const zoneColors = {
  central: '#d8af4b',
  north: '#2fa86f',
  east: '#0e5cb6',
  south: '#8a63d2',
  west: '#17a2a2',
  outer: '#76879d'
};

let config = { business: {}, zones: [] };
let map;
let marker;
let zoneLayers = {};
let activeZoneKey = 'central';

const zonePanels = document.getElementById('zonePanels');
const selectedZoneLabel = document.getElementById('selectedZoneLabel');
const selectedZoneInsight = document.getElementById('selectedZoneInsight');
const selectedRateChip = document.getElementById('selectedRateChip');
const heroZoneName = document.getElementById('heroZoneName');
const heroQuickTotal = document.getElementById('heroQuickTotal');
const businessEmail = document.getElementById('businessEmail');
const businessPhone = document.getElementById('businessPhone');
const footerBusinessName = document.getElementById('footerBusinessName');
const quoteForm = document.getElementById('quoteForm');
const heroQuoteForm = document.getElementById('heroQuoteForm');
const statusMessage = document.getElementById('statusMessage');
const mapPostcode = document.getElementById('mapPostcode');
const mapLookupBtn = document.getElementById('mapLookupBtn');
const saveOrderBtn = document.getElementById('saveOrderBtn');
const checkoutBtn = document.getElementById('checkoutBtn');

function getZoneConfig(zoneKey) {
  return config.zones.find((zone) => zone.key === zoneKey) || config.zones[0];
}

function setSelectedZone(zoneKey) {
  activeZoneKey = zoneKey;
  const zone = getZoneConfig(zoneKey);
  if (!zone) return;

  selectedZoneLabel.textContent = zone.name;
  selectedZoneInsight.textContent = zone.response;
  selectedRateChip.textContent = `From ${money(zone.ratePerThousand)} / 1,000`;

  document.querySelectorAll('.zone-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.zone === zoneKey);
  });

  Object.entries(zoneLayers).forEach(([key, layer]) => {
    layer.setStyle({
      fillOpacity: key === zoneKey ? 0.28 : 0.1,
      weight: key === zoneKey ? 3 : 2,
      opacity: key === zoneKey ? 1 : 0.55
    });
  });
}

function createZonePanels() {
  if (!zonePanels) return;
  zonePanels.innerHTML = config.zones.map((zone) => `
    <button type="button" class="zone-panel ${zone.key === activeZoneKey ? 'active' : ''}" data-zone="${zone.key}">
      <strong>${zone.name}</strong>
      <span>From ${money(zone.ratePerThousand)} / 1,000</span>
      <small>${zone.response}</small>
    </button>
  `).join('');

  zonePanels.querySelectorAll('.zone-panel').forEach((panel) => {
    panel.addEventListener('click', () => {
      setSelectedZone(panel.dataset.zone);
      if (map && zoneShapes[panel.dataset.zone]) {
        map.fitBounds(zoneShapes[panel.dataset.zone], { padding: [30, 30] });
      }
    });
  });
}

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;

  map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false }).setView([51.5072, -0.1276], 10);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  Object.entries(zoneShapes).forEach(([key, shape]) => {
    const layer = L.polygon(shape, {
      color: zoneColors[key],
      fillColor: zoneColors[key],
      fillOpacity: key === activeZoneKey ? 0.28 : 0.1,
      weight: key === activeZoneKey ? 3 : 2,
      opacity: key === activeZoneKey ? 1 : 0.55
    }).addTo(map);

    const zone = getZoneConfig(key);
    if (zone) layer.bindPopup(`<strong>${zone.name}</strong><br>${zone.response}<br>From ${money(zone.ratePerThousand)} / 1,000`);
    layer.on('click', () => setSelectedZone(key));
    zoneLayers[key] = layer;
  });

  marker = L.marker([51.5072, -0.1276]).addTo(map).bindPopup('Campaign lookup point');
}

function syncCheckboxCards() {
  document.querySelectorAll('.check-card').forEach((card) => {
    const input = card.querySelector('input');
    if (!input) return;
    const toggle = () => card.classList.toggle('active', input.checked);
    input.addEventListener('change', toggle);
    toggle();
  });
}

function getCalculatorData() {
  const formData = new FormData(quoteForm);
  return {
    customerName: formData.get('customerName') || '',
    companyName: formData.get('companyName') || '',
    email: formData.get('email') || '',
    phone: formData.get('phone') || '',
    postcode: String(formData.get('postcode') || '').trim(),
    quantity: Number(formData.get('quantity') || 5000),
    deliveryType: formData.get('deliveryType') || 'solus',
    priorityWindow: formData.get('priorityWindow') || 'standard',
    preferredStart: formData.get('preferredStart') || '',
    printIncluded: formData.get('printIncluded') === 'on',
    trackedDistribution: formData.get('trackedDistribution') === 'on',
    designNeeded: formData.get('designNeeded') === 'on',
    notes: formData.get('notes') || '',
    origin: window.location.origin
  };
}

function populateCalculatorFromHero() {
  if (!quoteForm || !heroQuoteForm) return;
  const data = new FormData(heroQuoteForm);
  quoteForm.elements.postcode.value = data.get('postcode') || '';
  quoteForm.elements.quantity.value = data.get('quantity') || '5000';
  quoteForm.elements.deliveryType.value = data.get('deliveryType') || 'solus';
}

function applyQuote(quote) {
  document.getElementById('distributionCost').textContent = money(quote.distributionCost);
  document.getElementById('printCost').textContent = money(quote.printCost);
  document.getElementById('trackingCost').textContent = money(quote.trackingFee);
  document.getElementById('designCost').textContent = money(quote.designFee);
  document.getElementById('setupCost').textContent = money(quote.setupFee);
  document.getElementById('priorityCost').textContent = money(quote.priorityFee);
  document.getElementById('subtotalCost').textContent = money(quote.subtotal);
  document.getElementById('vatCost').textContent = money(quote.vat);
  document.getElementById('totalCost').textContent = money(quote.total);
  document.getElementById('estimatedHomes').textContent = quote.estimatedHomes.toLocaleString();
  document.getElementById('estimatedDays').textContent = quote.estimatedDays;
  document.getElementById('ratePerThousand').textContent = money(quote.ratePerThousand);
  document.getElementById('summaryZone').textContent = quote.zoneName;
  document.getElementById('summaryInsight').textContent = quote.zoneInsight;
  heroZoneName.textContent = quote.zoneName;
  heroQuickTotal.textContent = money(quote.total);
  setSelectedZone(quote.zoneKey);
}

async function fetchQuote(payload) {
  const response = await fetch('https://leafletpro-backend.onrender.com/api/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Unable to calculate quote');
  return response.json();
}

async function refreshQuote() {
  if (!quoteForm) return;
  try {
    const quote = await fetchQuote(getCalculatorData());
    applyQuote(quote);
    return quote;
  } catch (error) {
    statusMessage.textContent = 'Unable to refresh the quote right now.';
  }
}

function normalisePostcode(postcode) {
  return String(postcode || '').trim().toUpperCase();
}

function zoneFromPostcode(postcode) {
  const cleaned = normalisePostcode(postcode).replace(/\s+/g, '');
  if (!cleaned) return getZoneConfig(activeZoneKey);
  return config.zones.find((zone) => zone.prefixes.some((prefix) => cleaned.startsWith(prefix))) || getZoneConfig('outer');
}

function lookupPostcode(postcode) {
  const zone = zoneFromPostcode(postcode);
  if (!zone) return;
  setSelectedZone(zone.key);
  if (map && zoneShapes[zone.key]) {
    map.fitBounds(zoneShapes[zone.key], { padding: [28, 28] });
    const center = L.polygon(zoneShapes[zone.key]).getBounds().getCenter();
    if (marker) marker.setLatLng(center).bindPopup(`${normalisePostcode(postcode) || zone.name}<br>${zone.name}`).openPopup();
  }
  return zone;
}

async function saveOrder() {
  if (!quoteForm.reportValidity()) return;
  statusMessage.textContent = 'Saving lead...';
  await refreshQuote();

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getCalculatorData())
  });
  const data = await response.json();
  if (!response.ok) {
    statusMessage.textContent = data.error || 'Could not save the order.';
    return;
  }
  statusMessage.textContent = `Lead ${data.id} saved successfully for ${data.zoneName}.`;
}

async function goToCheckout() {
  if (!quoteForm.reportValidity()) return;
  statusMessage.textContent = 'Creating Stripe checkout...';
  await refreshQuote();
  const response = await fetch('/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(getCalculatorData())
  });
  const data = await response.json();
  if (!response.ok) {
    statusMessage.textContent = data.error || 'Unable to create Stripe checkout.';
    return;
  }
  window.location.href = data.url;
}

async function loadConfig() {
  const response = await fetch('/api/config');
  config = await response.json();
  if (businessEmail) businessEmail.textContent = config.business.email;
  if (businessPhone) businessPhone.textContent = config.business.phone;
  if (footerBusinessName) footerBusinessName.textContent = config.business.name;
  createZonePanels();
  setSelectedZone(activeZoneKey);
}

async function init() {
  await loadConfig();
  initMap();
  syncCheckboxCards();
  await refreshQuote();

  if (heroQuoteForm) {
    heroQuoteForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      populateCalculatorFromHero();
      const quote = await refreshQuote();
      lookupPostcode(heroQuoteForm.elements.postcode.value);
      if (quote) {
        document.getElementById('calculator').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  [
    'quantitySelect',
    'deliveryTypeSelect',
    'priorityWindowSelect',
    'printIncluded',
    'trackedDistribution',
    'designNeeded'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', refreshQuote);
  });

  if (quoteForm?.elements.postcode) {
    quoteForm.elements.postcode.addEventListener('blur', (event) => {
      if (!event.target.value) return;
      lookupPostcode(event.target.value);
      refreshQuote();
    });
  }

  if (mapLookupBtn) {
    mapLookupBtn.addEventListener('click', () => {
      const value = mapPostcode.value || quoteForm?.elements.postcode?.value;
      const zone = lookupPostcode(value);
      if (zone) statusMessage.textContent = `${normalisePostcode(value)} maps to ${zone.name}.`;
    });
  }

  if (saveOrderBtn) saveOrderBtn.addEventListener('click', saveOrder);
  if (checkoutBtn) checkoutBtn.addEventListener('click', goToCheckout);
}

init();
const checkoutBtn = document.getElementById("checkoutBtn");

if (checkoutBtn) {
  checkoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();

    const totalText = document.getElementById("totalCost")?.textContent || "£0";
    const amount = Math.round(Number(totalText.replace(/[^\d.]/g, "")) * 100);

    if (!amount) {
      alert("Please generate a quote first.");
      return;
    }

    const response = await fetch("https://leafletpro-backend.onrender.com/create-checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ amount })
    });

    const session = await response.json();

    if (session.id) {
      await stripe.redirectToCheckout({ sessionId: session.id });
    } else {
      alert("Unable to start checkout.");
    }
  });
}
