const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';

async function loadOrders() {
  const res = await fetch(`${API_BASE}/api/orders`);
  const orders = await res.json();

  const container = document.getElementById('ordersContainer');
  container.innerHTML = '';

  orders.forEach(o => {
    const div = document.createElement('div');
    div.classList.add('order-card');

    // status color
    let statusColor = '#ffeb3b';
    if (o.status === 'Yangi') statusColor = '#ffeb3b';
    if (o.status === 'Qabul qilingan') statusColor = '#2196f3';
    if (o.status === 'Yetkazilmoqda') statusColor = '#ff9800';
    if (o.status === 'Tugallandi') statusColor = '#4caf50';

    div.innerHTML = `
      <h3 style="color:${statusColor};">Buyurtma #${o.id} — ${o.status}</h3>
      <p><b>Mijoz:</b> ${o.name} | <b>Tel:</b> ${o.phone} | <b>Manzil:</b> ${o.address}</p>
      <p><button class="accept-order" data-id="${o.id}">Buyurtmani qabul qilish</button></p>
      <div class="order-items" data-order-id="${o.id}" style="margin-top:8px;">${o.cart.map((it, idx) => `
        <div class="order-item" data-item-id="${it.id}" data-order-id="${o.id}">
          <b>${idx+1}.</b> ${it.name} x${it.quantity || 1}
          <button class="item-action" data-order-id="${o.id}" data-item-id="${it.id}">Holat</button>
          <span class="item-status">${it.status ? (it.status==='delivered' ? ' ✅' : ' ❌') : ''}</span>
        </div>
      `).join('')}</div>
    `;

    container.appendChild(div);
  });

  // attach handlers
  document.querySelectorAll('.accept-order').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = Number(e.target.getAttribute('data-id'));
      if (!confirm('Buyurtmani ishchilarga yubormoqchimisiz?')) return;
      await fetch(`${API_BASE}/api/orders/notify-workers`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId: id }) });
      loadOrders();
    });
  });

  document.querySelectorAll('.item-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orderId = Number(btn.getAttribute('data-order-id'));
      const itemId = Number(btn.getAttribute('data-item-id'));
      const parent = btn.parentElement;

      // disable the button so it can't be pressed again to show choices
      btn.disabled = true;

      const choices = document.createElement('span');
      choices.innerHTML = ` <button class="mark-delivered" data-order-id="${orderId}" data-item-id="${itemId}">Mahsulot berildi</button> <button class="mark-notfound" data-order-id="${orderId}" data-item-id="${itemId}">Mahsulot topilmadi</button>`;
      parent.appendChild(choices);

      choices.querySelectorAll('.mark-delivered, .mark-notfound').forEach(c => {
        c.addEventListener('click', async (ev) => {
          const status = ev.target.classList.contains('mark-delivered') ? 'delivered' : 'not_found';
          // send update
          const res = await fetch(`${API_BASE}/api/orders/item-update`, { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ orderId, itemId, status }) });
          const data = await res.json();
          if (data.success) {
            // show check or cross
            const span = parent.querySelector('.item-status');
            span.textContent = status==='delivered' ? ' ✅' : ' ❌';
            // disable both choice buttons
            choices.querySelectorAll('button').forEach(b => b.disabled = true);
            // refresh orders to update overall status
            setTimeout(loadOrders, 500);
          } else {
            alert('Xatolik: ' + (data.error || 'Server'));
          }
        });
      });
    });
  });
}

// initial
loadOrders();
// optional: auto refresh every 10s
setInterval(loadOrders, 10000);