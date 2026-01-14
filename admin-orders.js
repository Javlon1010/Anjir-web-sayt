const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000' : '';

// Server mode flag (set by /api/server-info)
let serverReadOnly = false;

// Status colors and their order
const statuses = [
  { id: 'Yangi', name: 'Yangi', color: '#ffeb3b', next: 'Qabul qilindi' },
  { id: 'Qabul qilindi', name: 'Qabul qilindi', color: '#2196f3', next: 'Yetkazilmoqda' },
  { id: 'Yetkazilmoqda', name: 'Yetkazilmoqda', color: '#ff9800', next: 'Yetkazib berildi' },
  { id: 'Yetkazib berildi', name: 'Yetkazib berildi', color: '#4caf50', next: null },
  { id: 'Bekor qilindi', name: 'Bekor qilindi', color: '#f44336', next: null }
];

// Format date
function formatDate(dateString) {
  const options = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleDateString('uz-UZ', options);
}

// Load and display orders
async function loadOrders(showCompleted = false) {
  try {
    const res = await fetch(`${API_BASE}/api/orders?completed=${showCompleted}`);
    const orders = await res.json();
    const container = document.getElementById('ordersContainer');
    
    if (orders.length === 0) {
      container.innerHTML = `
        <div class="no-orders">
          <p>Hozircha ${showCompleted ? 'tugallangan' : 'faol'} buyurtmalar mavjud emas</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => {
      const statusInfo = statuses.find(s => s.id === order.status) || statuses[0];
      const total = order.cart.reduce((sum, item) => {
        return sum + (parseInt(item.price.replace(/\D/g, '')) * (item.quantity || 1));
      }, 0);

      return `
        <div class="order-card" data-order-id="${order.id}">
          <div class="order-header">
            <div class="order-meta">
              <h3>Buyurtma #${order.orderNumber || order.id}</h3>
              <span class="order-date">${formatDate(order.createdAt)}</span>
            </div>
            <div class="order-status" style="background-color: ${statusInfo.color}20; color: ${statusInfo.color};">
              ${statusInfo.name}
            </div>
          <div class="order-customer">
            <p><strong>👤 Mijoz:</strong> ${order.name}</p>
            <p><strong>📞 Telefon:</strong> ${order.phone}</p>
            ${order.address ? `<p><strong>📍 Manzil:</strong> ${order.address}</p>` : ''}
            ${order.location ? `<p><strong>📍 Joylashuv:</strong> ${order.location}</p>` : ''}
          </div>
          
          <div class="order-items">
            <h4>Buyurtma tarkibi:</h4>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Mahsulot</th>
                  <th>Narxi</th>
                  <th>Miqdori</th>
                  <th>Jami</th>
                </tr>
              </thead>
              <tbody>
                ${order.cart.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>
                      <button class="item-btn" data-order-id="${order.id}" data-item-idx="${index}" ${item.status==='delivered' ? 'disabled' : ''}>
                        ${item.name} ${item.status==='delivered' ? ' ✅' : (item.status==='not_found' ? ' ❌' : '')}
                      </button>
                      ${serverReadOnly ? `
                        <div class="item-actions" data-order-id="${order.id}" data-item-idx="${index}" style="display:none; margin-top:8px; color:#b71c1c;">
                          Bu deploy yozish uchun mos emas — item holatini o‘zgartirish mumkin emas
                        </div>
                      ` : `
                        <div class="item-actions" data-order-id="${order.id}" data-item-idx="${index}" style="display:none; margin-top:8px;">
                          <button class="item-action-btn green item-action-delivered" data-order-id="${order.id}" data-item-idx="${index}">✅ Mahsulot berildi</button>
                          <button class="item-action-btn red item-action-notfound" data-order-id="${order.id}" data-item-idx="${index}">${item.status==='not_found' ? '🔁 Bekor qilish' : '❌ Mahsulot topilmadi'}</button>
                        </div>
                      `}
                    </td>
                    <td>${item.price} so'm</td>
                    <td>${item.quantity || 1} ta</td>
                    <td>${(parseInt(item.price.replace(/\D/g, '')) * (item.quantity || 1)).toLocaleString()} so'm</td>
                  </tr>
                `).join('')}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: right;"><strong>Umumiy summa:</strong></td>
                  <td><strong>${total.toLocaleString()} so'm</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div class="order-actions">
            ${serverReadOnly ? `
              <div style="color:#b71c1c; font-weight:600;">Ushbu deploy yozish uchun mos emas — buyurtma holatini o‘zgartirish mumkin emas</div>
              <button class="btn btn-details" data-id="${order.id}">
                Batafsil
              </button>
            ` : `
              ${statusInfo.next ? `
                <button class="btn btn-next" data-id="${order.id}" data-next="${statusInfo.next}">
                  ${statusInfo.next}
                </button>
              ` : ''}
              
              ${order.status !== 'Bekor qilindi' ? `
                <button class="btn btn-cancel" data-id="${order.id}">
                  Bekor qilish
                </button>
              ` : ''}
              
              ${order.status === 'Yetkazib berildi' && !order.isCompleted ? `
                <button class="btn btn-complete" data-id="${order.id}">
                  Buyurtmani yakunlash
                </button>
              ` : ''}
              
              <button class="btn btn-details" data-id="${order.id}">
                Batafsil
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
    
    // Attach event listeners
    attachEventListeners();
    
  } catch (error) {
    console.error('Error loading orders:', error);
    document.getElementById('ordersContainer').innerHTML = `
      <div class="error-message">
        <p>Buyurtmalarni yuklashda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.</p>
        <button onclick="loadOrders()">Qayta yuklash</button>
      </div>
    `;
  }
}

// Attach event listeners to order actions
function attachEventListeners() {
  // Next status button
  document.querySelectorAll('.btn-next').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const orderId = e.target.getAttribute('data-id');
      const nextStatus = e.target.getAttribute('data-next');
      
      try {
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });
        
        if (response.ok) {
          showToast({ message: 'Buyurtma holati yangilandi', type: 'success' });
          loadOrders(document.querySelector('.tab.active')?.dataset.tab === 'completed');
        } else {
          throw new Error('Failed to update status');
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        showToast({ message: 'Xatolik yuz berdi', type: 'error' });
      }
    });
  });
  
  // Cancel order button
  document.querySelectorAll('.btn-cancel').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('Buyurtmani bekor qilishni istaysizmi?')) return;
      
      const orderId = e.target.getAttribute('data-id');
      
      try {
        const response = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Bekor qilindi' })
        });
        
        if (response.ok) {
          showToast({ message: 'Buyurtma bekor qilindi', type: 'success' });
          loadOrders(document.querySelector('.tab.active')?.dataset.tab === 'completed');
        } else {
          throw new Error('Failed to cancel order');
        }
      } catch (error) {
        console.error('Error cancelling order:', error);
        showToast({ message: 'Xatolik yuz berdi', type: 'error' });
      }
    });
  });
  
  // Complete order button
  document.querySelectorAll('.btn-complete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('Buyurtmani yakunlashni istaysizmi? Mahsulotlar soni avtomatik ravishda kamaytiriladi.')) return;
      
      const orderId = e.target.getAttribute('data-id');
      
      try {
        const response = await fetch(`${API_BASE}/api/orders/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId })
        });
        
        if (response.ok) {
          const result = await response.json();
          showToast({ 
            message: `Buyurtma #${result.orderNumber} muvaffaqiyatli yakunlandi. Mahsulotlar soni yangilandi.`, 
            type: 'success' 
          });
          loadOrders(document.querySelector('.tab.active')?.dataset.tab === 'completed');
        } else {
          const error = await response.json();
          throw new Error(error.error || 'Failed to complete order');
        }
      } catch (error) {
        console.error('Error completing order:', error);
        showToast({ 
          message: `Xatolik: ${error.message || 'Buyurtmani yakunlashda xatolik yuz berdi'}`, 
          type: 'error' 
        });
      }
    });
  });

  // Item button toggle (show/hide action buttons)
  document.querySelectorAll('.item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const orderId = btn.getAttribute('data-order-id');
      const idx = btn.getAttribute('data-item-idx');
      const panel = document.querySelector(`.item-actions[data-order-id="${orderId}"][data-item-idx="${idx}"]`);
      if (!panel) return;
      panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'block' : 'none';
    });
  });

  // Delivered action
  document.querySelectorAll('.item-action-delivered').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const orderId = btn.getAttribute('data-order-id');
      const idx = Number(btn.getAttribute('data-item-idx'));
      try {
        const res = await fetch(`${API_BASE}/api/orders/item-update`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, itemId: idx, status: 'delivered' })
        });
        const data = await res.json();
        if (!data || !data.success) {
          showToast({ message: 'Xatolik: ' + (data && data.error ? data.error : 'Noma\'lum xato'), type: 'error' });
          return;
        }
        if (data.already) {
          showToast({ message: 'Allaqachon belgilangan', type: 'info' });
          return;
        }
        // update UI: set base name and add ✅
        const btnSel = document.querySelector(`.item-btn[data-order-id="${orderId}"][data-item-idx="${idx}"]`);
        if (btnSel) {
          const base = btnSel.textContent.replace(/ ✅| ❌/g, '').trim();
          btnSel.textContent = `${base} ✅`;
          btnSel.disabled = true;
          btnSel.classList.remove('not-found');
          btnSel.classList.add('delivered');
        }
        const panel = document.querySelector(`.item-actions[data-order-id="${orderId}"][data-item-idx="${idx}"]`);
        if (panel) panel.style.display = 'none';
        showToast({ message: 'Mahsulot belgilandi ✅', type: 'success' });
      } catch (err) {
        console.error(err);
        showToast({ message: 'Serverga ulanishda xatolik', type: 'error' });
      }
    });
  });

  // Not found action (toggle)
  document.querySelectorAll('.item-action-notfound').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const orderId = btn.getAttribute('data-order-id');
      const idx = Number(btn.getAttribute('data-item-idx'));
      try {
        const res = await fetch(`${API_BASE}/api/orders/item-update`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, itemId: idx, status: 'not_found' })
        });
        const data = await res.json();
        if (!data || !data.success) {
          showToast({ message: 'Xatolik: ' + (data && data.error ? data.error : 'Noma\'lum xato'), type: 'error' });
          return;
        }
        // update UI: toggle ❌ based on returned status
        const btnSel = document.querySelector(`.item-btn[data-order-id="${orderId}"][data-item-idx="${idx}"]`);
        const panel = document.querySelector(`.item-actions[data-order-id="${orderId}"][data-item-idx="${idx}"]`);
        if (btnSel) {
          const base = btnSel.textContent.replace(/ ✅| ❌/g, '').trim();
          if (data.itemStatus === 'not_found') {
            btnSel.textContent = `${base} ❌`;
            btnSel.classList.remove('delivered');
            btnSel.classList.add('not-found');
            btnSel.disabled = false;
          } else {
            btnSel.textContent = base;
            btnSel.classList.remove('not-found');
          }
        }
        if (panel) panel.style.display = 'none';
        showToast({ message: data.itemStatus === 'not_found' ? 'Mahsulot topilmadi ❌' : 'Belgisi olib tashlandi', type: 'info' });
      } catch (err) {
        console.error(err);
        showToast({ message: 'Serverga ulanishda xatolik', type: 'error' });
      }
    });
  });

  // Toggle order details
  document.querySelectorAll('.order-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const orderCard = e.target.closest('.order-card');
      if (orderCard) {
        const details = orderCard.querySelector('.order-details');
        if (details) {
          details.style.display = details.style.display === 'none' ? 'block' : 'none';
        }
      }
    });
  });
}

// Toggle between active and completed orders
async function checkServerInfo() {
  try {
    const res = await fetch(`${API_BASE}/api/server-info`);
    if (!res.ok) return;
    const info = await res.json();
    if (info.readOnlyFiles) {
      serverReadOnly = true;
      showToast({ message: 'Eslatma: ushbu deploy yozish uchun mos emas — buyurtma o‘zgartirishlar saqlanmaydi', type: 'warning', timeout: 6000 });
    }
  } catch (err) { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Tabs
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadOrders(tab.dataset.tab === 'completed');
    });
  });
  
  // Check server first, then load orders so UI reflects read-only mode
  await checkServerInfo();
  loadOrders();
  
  // Auto-refresh every 30 seconds
  setInterval(() => {
    loadOrders(document.querySelector('.tab.active')?.dataset.tab === 'completed');
  }, 30000);
});