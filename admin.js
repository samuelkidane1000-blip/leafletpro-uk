const ordersTableBody = document.getElementById('ordersTableBody');
const stats = document.getElementById('stats');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const paymentFilter = document.getElementById('paymentFilter');
const detailContent = document.getElementById('detailContent');

let orders = [];
let selectedOrderId = null;

const money = (value) => `£${Number(value || 0).toFixed(2)}`;
const fmtDate = (value) => new Date(value).toLocaleString();

function badgeClass(paymentStatus) {
  if (paymentStatus === 'Paid') return 'paid';
  if (paymentStatus === 'Refunded') return 'refunded';
  return 'pending';
}

function renderStats(currentOrders) {
  const pipeline = currentOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const paidValue = currentOrders.filter((order) => order.paymentStatus === 'Paid').reduce((sum, order) => sum + Number(order.total || 0), 0);
  const newLeads = currentOrders.filter((order) => order.status === 'New lead').length;
  const booked = currentOrders.filter((order) => order.status === 'Booked').length;

  stats.innerHTML = `
    <article class="stat-card"><strong>${currentOrders.length}</strong><span>Total orders</span></article>
    <article class="stat-card"><strong>${money(pipeline)}</strong><span>Total pipeline value</span></article>
    <article class="stat-card"><strong>${money(paidValue)}</strong><span>Paid revenue</span></article>
    <article class="stat-card"><strong>${newLeads}</strong><span>New leads</span></article>
    <article class="stat-card"><strong>${booked}</strong><span>Booked campaigns</span></article>
  `;
}

function filteredOrders() {
  const term = searchInput.value.trim().toLowerCase();
  return orders.filter((order) => {
    const searchable = [order.id, order.customerName, order.companyName, order.email, order.postcode].join(' ').toLowerCase();
    const matchesSearch = !term || searchable.includes(term);
    const matchesStatus = statusFilter.value === 'all' || order.status === statusFilter.value;
    const matchesPayment = paymentFilter.value === 'all' || order.paymentStatus === paymentFilter.value;
    return matchesSearch && matchesStatus && matchesPayment;
  });
}

function renderRows() {
  const currentOrders = filteredOrders();
  renderStats(currentOrders);

  if (!currentOrders.length) {
    ordersTableBody.innerHTML = '<tr><td colspan="7">No orders match these filters.</td></tr>';
    detailContent.innerHTML = '<div class="detail-empty">Nothing selected.</div>';
    return;
  }

  ordersTableBody.innerHTML = currentOrders.map((order) => `
    <tr data-order-id="${order.id}" class="${order.id === selectedOrderId ? 'selected' : ''}">
      <td>
        <strong>${order.id}</strong>
        <div class="meta">${fmtDate(order.createdAt)}</div>
      </td>
      <td>
        <strong>${order.customerName || 'Unknown'}</strong>
        <div class="meta">${order.companyName || order.email || ''}</div>
      </td>
      <td>
        <strong>${order.zoneName || ''}</strong>
        <div class="meta">${order.postcode || ''}</div>
      </td>
      <td>${Number(order.quantity || 0).toLocaleString()}</td>
      <td>${money(order.total)}</td>
      <td><span class="badge status">${order.status}</span></td>
      <td><span class="badge ${badgeClass(order.paymentStatus)}">${order.paymentStatus}</span></td>
    </tr>
  `).join('');

  ordersTableBody.querySelectorAll('tr[data-order-id]').forEach((row) => {
    row.addEventListener('click', () => {
      selectedOrderId = row.dataset.orderId;
      renderRows();
      renderDetail();
    });
  });

  if (!selectedOrderId && currentOrders[0]) {
    selectedOrderId = currentOrders[0].id;
    renderRows();
    renderDetail();
  }
}

async function patchOrder(id, patch) {
  const response = await fetch(`/api/orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to update order');
  const index = orders.findIndex((order) => order.id === id);
  if (index >= 0) orders[index] = data;
  return data;
}

function renderDetail() {
  const order = orders.find((item) => item.id === selectedOrderId);
  if (!order) {
    detailContent.innerHTML = '<div class="detail-empty">Nothing selected.</div>';
    return;
  }

  detailContent.innerHTML = `
    <div class="detail-grid">
      <div class="info-card">
        <strong>${order.customerName || 'Unknown customer'}</strong>
        <div class="meta">${order.companyName || 'No company supplied'} · ${order.email || 'No email'} · ${order.phone || 'No phone'}</div>
      </div>

      <div class="info-grid">
        <div><span>Order ID</span><strong>${order.id}</strong></div>
        <div><span>Created</span><strong>${fmtDate(order.createdAt)}</strong></div>
        <div><span>Postcode</span><strong>${order.postcode || '—'}</strong></div>
        <div><span>Zone</span><strong>${order.zoneName || '—'}</strong></div>
        <div><span>Quantity</span><strong>${Number(order.quantity || 0).toLocaleString()}</strong></div>
        <div><span>Total</span><strong>${money(order.total)}</strong></div>
        <div><span>Delivery</span><strong>${order.deliveryType || '—'}</strong></div>
        <div><span>Preferred start</span><strong>${order.preferredStart || '—'}</strong></div>
      </div>

      <label>
        <span>Status</span>
        <select id="detailStatus">
          ${['New lead','Awaiting payment','Booked','Scheduled','Completed'].map((status) => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
      </label>

      <label>
        <span>Payment status</span>
        <select id="detailPaymentStatus">
          ${['Pending','Paid','Refunded'].map((status) => `<option value="${status}" ${order.paymentStatus === status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
      </label>

      <label>
        <span>Notes</span>
        <textarea id="detailNotes" rows="6">${order.notes || ''}</textarea>
      </label>

      <div class="actions-grid">
        <button id="saveDetailBtn" class="small-btn">Save changes</button>
      </div>
    </div>
  `;

  document.getElementById('saveDetailBtn').addEventListener('click', async () => {
    const patch = {
      status: document.getElementById('detailStatus').value,
      paymentStatus: document.getElementById('detailPaymentStatus').value,
      notes: document.getElementById('detailNotes').value
    };
    await patchOrder(order.id, patch);
    renderRows();
    renderDetail();
  });
}

async function loadOrders() {
  const response = await fetch('/api/orders');
  orders = await response.json();
  renderRows();
}

refreshBtn.addEventListener('click', loadOrders);
searchInput.addEventListener('input', renderRows);
statusFilter.addEventListener('change', renderRows);
paymentFilter.addEventListener('change', renderRows);
loadOrders();
