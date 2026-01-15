const addBtn = document.getElementById("addBtn");
const nameInput = document.getElementById("name");
const priceInput = document.getElementById("price");
const imageInput = document.getElementById("image");
const categorySelect = document.getElementById("category");
const adminFilterCategory = document.getElementById('adminFilterCategory');
const adminSearch = document.getElementById('adminSearch');
const adminFilterClear = document.getElementById('adminFilterClear');
const statusMsg = document.getElementById("statusMsg");
const container = document.getElementById("productContainer");

// Server mode flag (set after checking /api/server-info)
let serverReadOnly = false;

// Admin Password (get from user on load or default)
let adminPassword = '';

// Helper function to get auth headers
function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-password': adminPassword
  };
}

// Toast xabarnoma funksiyasi
// ✏️ Edit modal elementlar
const editModal = document.getElementById("editModal");
const editId = document.getElementById("editId");
const editName = document.getElementById("editName");
const editPrice = document.getElementById("editPrice");
const editImage = document.getElementById("editImage");
const editCategory = document.getElementById("editCategory");
const editStock = document.getElementById("editStock");
const saveEditBtn = document.getElementById("saveEditBtn");
const closeEditBtn = document.getElementById("closeEditBtn");

// API URL — use localhost during local development, otherwise use relative path for deployment
const API_URL = (window.location.hostname === '' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000/api/products'
  : '/api/products';

// ➕ Yangi mahsulot qo'shish (admin)
addBtn.addEventListener("click", async () => {
  if (serverReadOnly) {
    showToast({ message: "Bu muhit yozish uchun mos emas — MONGODB_URI sozlang", type: 'warning' });
    return;
  }

  const name = nameInput.value.trim();
  const price = priceInput.value.trim();
  const image = imageInput.value.trim();
  const category = categorySelect.value;
  const stock = Number(document.getElementById('stock').value) || 35;

  if (!name || !price || !image || !category) {
    showToast({ message: "Iltimos, ma'lumotlaringizni to'liq kiriting va telefon raqamingizni to'g'ri kiriting", type: 'warning' });
    return;
  }

  showToast({ message: "Yuklanmoqda...", type: 'info', timeout: 2000 });

  try {
    const res = await fetch(`${API_URL}/add`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, price, image, category, stock }),
    });

    const data = await res.json();

    if (data.success) {
      showToast({ message: "Mahsulot qo‘shildi!", type: 'success' });
      nameInput.value = "";
      priceInput.value = "";
      imageInput.value = "";
      categorySelect.value = "";
      document.getElementById('stock').value = 35;
      // show all products by default after adding
      adminFilterCategory.value = 'Barchasi';
      adminSearch.value = '';
      loadProducts({ category: 'Barchasi' });
    } else {
      showToast({ message: "Xatolik: " + (data.error || "Noma'lum xatolik"), type: 'error' });
    }
  } catch (err) {
    console.error(err);
    showToast({ message: "Serverga ulanishda xatolik", type: 'error' });
  }
});

// 🟢 Mahsulotlarni chiqarish
async function loadProducts(options = {}) {
  const { category, q } = options;

  // Agar admin filter kategoriya bo'sh string bo'lsa, hech narsa ko'rsatilmasin (placeholder tanlandi). "Barchasi" bo'lsa, hamma mahsulotlarni ko'rsatamiz
  if (typeof category !== 'undefined' && category === '') {
    container.innerHTML = "<p style='text-align:center;'>🔎 Iltimos, to‘g‘ri kategoriya tanlang</p>";
    return;
  }

  const params = new URLSearchParams();
  // if category provided and not "Barchasi", filter by it; otherwise fetch all products
  if (category && category !== 'Barchasi') params.set('category', category);
  if (q) params.set('q', q);

  const url = `${API_URL}${params.toString() ? ('?' + params.toString()) : ''}`;
  const res = await fetch(url);
  const products = await res.json();

  container.innerHTML = "";
  products.forEach((p) => {
    const card = document.createElement("div");
    card.classList.add("product-card");

    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}" />
      <h3>${p.name}</h3>
      <p>${p.price}</p>
      <small>${p.category} · Qolgan: ${p.stock || 0} · Sotildi: ${p.sold || 0}</small><br>

      ${serverReadOnly ? `
        <div style="margin-top:8px; color:#b71c1c; font-weight:600;">Bu deploy yozish uchun mos emas — tahrir saqlanmaydi</div>
      ` : `
        <button class="edit-btn" data-id="${p.id}">✏️ Tahrirlash</button>
        <button class="delete-btn" data-id="${p.id}">🗑 O‘chirish</button>
      `}
    `;

    container.appendChild(card);
  });

  // 🗑 O‘chirish tugmalari
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = Number(e.target.dataset.id);

      try {
        const res = await fetch(`${API_URL}/delete`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          showToast({ message: "Xatolik: " + (data.error || "Noma'lum xato"), type: 'error' });
        } else {
          showToast({ message: "Mahsulot o‘chirildi", type: 'success' });
        }
      } catch (err) {
        console.error('Delete product error:', err);
        showToast({ message: "Serverga ulanishda xatolik", type: 'error' });
      }

      loadProducts();
    });
  });

  // ✏️ Tahrirlash tugmalari
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = Number(e.target.dataset.id);

      // 🔎 Mahsulotni topish
      const res = await fetch(API_URL);
      const products = await res.json();
      const product = products.find((p) => Number(p.id) === id);

      if (!product) {
        showToast({ message: "Mahsulot topilmadi!", type: 'error' });
        return;
      }

      // Modalga ma'lumotlarni joylash
      editId.value = product.id;
      editName.value = product.name;
      editPrice.value = product.price;
      editImage.value = product.image;
      editCategory.value = product.category;
      editStock.value = product.stock || 35;

      editModal.style.display = "block";
    });
  });
}

// 💾 Tahrirni saqlash
saveEditBtn.addEventListener("click", async () => {
  if (serverReadOnly) {
    showToast({ message: "Bu muhit yozish uchun mos emas — MONGODB_URI sozlang", type: 'warning' });
    return;
  }

  const updateData = {
    id: Number(editId.value),
    name: editName.value.trim(),
    price: editPrice.value.trim(),
    image: editImage.value.trim(),
    category: editCategory.value,
    stock: Number(editStock.value) || 0,
  };

  try {
    const res = await fetch(`${API_URL}/edit`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(updateData),
    });

    const data = await res.json();

    if (data.success) {
      showToast({ message: "Mahsulot yangilandi!", type: 'success' });
      editModal.style.display = "none";
      loadProducts();
    } else {
      showToast({ message: "Xatolik: " + (data.error || 'Noma\'lum xatolik'), type: 'error' });
    }
  } catch (err) {
    console.error('Edit product error:', err);
    showToast({ message: "Serverga ulanishda xatolik", type: 'error' });
  }
});

// ❌ Modalni yopish
closeEditBtn.addEventListener("click", () => {
  editModal.style.display = "none";
});

// � Kategoriyalarni yuklash
async function loadCategories() {
  try {
    const res = await fetch((window.location.hostname === 'localhost' || window.location.hostname === '' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api/products/categories' : '/api/products/categories');
    const cats = await res.json();
    // add a dedicated "Barchasi" option (shows all products when selected)
    adminFilterCategory.innerHTML = '<option value="">— Kategoriya tanlang —</option><option value="Barchasi">Barchasi</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    // Set default to show all products so admin doesn't accidentally land on placeholder
    adminFilterCategory.value = 'Barchasi';
    // add missing categories to add/edit selects if not present
    const addOptions = Array.from(categorySelect.options).map(o => o.value);
    cats.forEach(c => {
      if (!addOptions.includes(c)) {
        categorySelect.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`);
        editCategory.insertAdjacentHTML('beforeend', `<option value="${c}">${c}</option>`);
      }
    });
  } catch (err) {
    console.error('loadCategories error:', err);
  }
}

// Filter va search eventlari
adminFilterCategory.addEventListener('change', () => {
  const cat = adminFilterCategory.value;
  // If placeholder is selected (empty string), treat as 'Barchasi'
  loadProducts({ category: cat === '' ? 'Barchasi' : cat });
});

adminSearch.addEventListener('input', () => {
  const q = adminSearch.value.trim();
  const catVal = adminFilterCategory.value;
  const cat = (typeof catVal === 'undefined' || catVal === '' ) ? 'Barchasi' : catVal;
  loadProducts({ category: cat, q });
});

adminFilterClear.addEventListener('click', () => {
  adminFilterCategory.value = 'Barchasi';
  adminSearch.value = '';
  loadProducts({ category: 'Barchasi' });
});

// 🚀 Dastlab yuklash
(async function initAdmin() {
  try {
    await loadCategories();
  } catch (err) {
    console.error('Initial loadCategories failed:', err);
  }

  // default: show all products in admin
  loadProducts({ category: 'Barchasi' });
  loadOrders();
  // Auto-refresh orders every 8 seconds so admin sees incoming orders
  setInterval(loadOrders, 8000);

  // Check server info (read-only deployments on platforms like Vercel)
  try {
    const res = await fetch('/api/server-info');
    if (res && res.ok) {
      const info = await res.json();

      if (info.readOnlyFiles) {
        serverReadOnly = true;
        if (statusMsg) statusMsg.innerHTML = '<strong style="color:#b71c1c">Eslatma:</strong> Bu muhit yozish uchun mos emas (suziladigan hosting). Mahsulotlar va buyurtmalarni buyurtmalarni tahrirlash uchun <code>MONGODB_URI</code> sozlang.';
        showToast({ message: 'Server deployi read-only rejimda: MONGODB_URI sozlang persistence uchun', type: 'warning', timeout: 8000 });
        // adjust UI immediately
        addBtn.disabled = true;
        saveEditBtn.disabled = true;
        nameInput.disabled = true;
        priceInput.disabled = true;
        imageInput.disabled = true;
        categorySelect.disabled = true;
        document.getElementById('stock').disabled = true;
        // reload products so the edit/delete buttons are removed and replaced with notice
        loadProducts({ category: adminFilterCategory.value || 'Barchasi' });
        return;
      }

      if (!info.useMongo) {
        if (statusMsg) statusMsg.innerHTML = '<strong style="color:#b71c1c">Eslatma:</strong> MONGODB_URI topilmadi — maʼlumotlar faylga yozilmoqda (bu deployda yozish muammoli).';
        showToast({ message: 'MONGODB_URI mavjud emas — yozish rejimi cheklangan', type: 'warning', timeout: 8000 });
        return;
      }

      if (info.useMongo && info.dbConnected === false) {
        if (statusMsg) statusMsg.innerHTML = `<strong style="color:#b71c1c">DB xatosi:</strong> ${info.dbError || 'bog‘lanishda xatolik'} <button id="dbTestBtn" class="btn">Qayta tekshirish</button>`;
        showToast({ message: 'MongoDB bilan bog‘lanishda xatolik: tekshiring', type: 'error', timeout: 8000 });
        setTimeout(() => {
          const btn = document.getElementById('dbTestBtn');
          if (btn) btn.addEventListener('click', testDb);
        }, 0);
        return;
      }

      if (info.useMongo && info.dbConnected === true) {
        if (statusMsg) statusMsg.innerHTML = '<strong style="color:#2e7d32">DB: bog‘langan</strong>';
      }
    }
  } catch (err) {
    // ignore
  }
})();

// DB re-check function (used when server-info reports DB error)
async function testDb() {
  try {
    const res = await fetch('/api/db-test');
    const data = await res.json();
    if (res.ok && data.ok) {
      showToast({ message: 'MongoDB: ulangan', type: 'success' });
      if (statusMsg) statusMsg.innerHTML = '<strong style="color:#2e7d32">DB: bog‘langan</strong>';
      loadProducts({ category: adminFilterCategory.value || 'Barchasi' });
    } else {
      showToast({ message: 'DB xatosi: ' + (data.message || 'Nomaʼlum xato'), type: 'error' });
      if (statusMsg) statusMsg.innerHTML = `<strong style="color:#b71c1c">DB xatosi:</strong> ${data.message || 'xato'}`;
    }
  } catch (err) {
    showToast({ message: 'Serverga ulanishda xatolik', type: 'error' });
  }
}

// === Buyurtmalarni chiqarish va boshqarish ===
async function loadOrders() {
  try {
    const res = await fetch((window.location.hostname === 'localhost' || window.location.hostname === '' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api/orders' : '/api/orders');
    const orders = await res.json();

    const ordersContainer = document.getElementById('ordersContainer');
    ordersContainer.innerHTML = '';

    if (!orders || orders.length === 0) {
      ordersContainer.innerHTML = '<p>📭 Hozircha buyurtma yo‘q.</p>';
      return;
    }

    orders.forEach((o) => {
      const div = document.createElement('div');
      div.classList.add('order-card');
      div.innerHTML = `
        <h3>Buyurtma #${o.id} — ${o.status}</h3>
        <p><b>Ism:</b> ${o.name} | <b>Telefon:</b> ${o.phone}</p>
        <p><b>Manzil:</b> ${o.address}</p>
        <p><b>Jami:</b> ${o.total} so'm | <small>${o.date}</small></p>
        <div><b>Mahsulotlar:</b> ${o.cart.map(i => `${i.name} x${i.quantity || 1}`).join(', ')}</div>
        <div style="margin-top:8px;">
          <select data-id="${o.id}" class="order-status-select">
            <option ${o.status==='Yangi'? 'selected':''}>Yangi</option>
            <option ${o.status==='Qabul qilingan'? 'selected':''}>Qabul qilingan</option>
            <option ${o.status==='Yetkazilmoqda'? 'selected':''}>Yetkazilmoqda</option>
            <option ${o.status==='Tugallandi'? 'selected':''}>Tugallandi</option>
          </select>
          <button class="update-order" data-id="${o.id}">Yangilash</button>
        </div>
      `;

      ordersContainer.appendChild(div);
    });

    document.querySelectorAll('.update-order').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const id = Number(e.target.getAttribute('data-id'));
        const select = document.querySelector(`select[data-id="${id}"]`);
        const status = select.value;

        await fetch((window.location.hostname === 'localhost' || window.location.hostname === '' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api/orders/update' : '/api/orders/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, status }),
        });

        showToast({ message: 'Buyurtma holati yangilandi', type: 'success' });
        loadOrders();
      });
    });

  } catch (err) {
    console.error('loadOrders error:', err);
    const ordersContainer = document.getElementById('ordersContainer');
    if (ordersContainer) {
      ordersContainer.innerHTML = `<div class="error-message">
        <p>Buyurtmalarni yuklashda xatolik yuz berdi: ${err && err.message ? err.message : 'Serverga ulanishda xatolik'}</p>
      </div>`;
    }
  }
}

// Initialize admin password on page load
document.addEventListener('DOMContentLoaded', () => {
  adminPassword = prompt('Admin panelga kirish uchun parolni kiriting:') || '';
  if (!adminPassword) {
    adminPassword = ''; // Will require password for actions
    showToast({ message: '⚠️ Parol kiritmadi. Admin amallar uchun parol talab qilinadi.', type: 'warning' });
  }
  loadCategories();
  loadProducts();
});
