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
  const name = nameInput.value.trim();
  const price = priceInput.value.trim();
  const image = imageInput.value.trim();
  const category = categorySelect.value;
  const stock = Number(document.getElementById('stock').value) || 35;

  if (!name || !price || !image || !category) {
    showToast({ message: "Iltimos, hamma maydonlarni to‘ldiring", type: 'warning' });
    return;
  }

  showToast({ message: "Yuklanmoqda...", type: 'info', timeout: 2000 });

  try {
    const res = await fetch(`${API_URL}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

      <button class="edit-btn" data-id="${p.id}">✏️ Tahrirlash</button>
      <button class="delete-btn" data-id="${p.id}">🗑 O‘chirish</button>
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
          headers: { "Content-Type": "application/json" },
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
  const updateData = {
    id: Number(editId.value),
    name: editName.value.trim(),
    price: editPrice.value.trim(),
    image: editImage.value.trim(),
    category: editCategory.value,
    stock: Number(editStock.value) || 0,
  };

  const res = await fetch(`${API_URL}/edit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updateData),
  });

  const data = await res.json();

  if (data.success) {
    showToast({ message: "Mahsulot yangilandi!", type: 'success' });
    editModal.style.display = "none";
    loadProducts();
  } else {
    showToast({ message: "Xatolik: " + data.error, type: 'error' });
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
  loadProducts({ category: cat });
});

adminSearch.addEventListener('input', () => {
  const q = adminSearch.value.trim();
  const cat = adminFilterCategory.value;
  loadProducts({ category: cat, q });
});

adminFilterClear.addEventListener('click', () => {
  adminFilterCategory.value = 'Barchasi';
  adminSearch.value = '';
  loadProducts({ category: 'Barchasi' });
});

// 🚀 Dastlab yuklash
loadCategories();
// default: show all products in admin
loadProducts({ category: 'Barchasi' });
loadOrders();
// Auto-refresh orders every 8 seconds so admin sees incoming orders
setInterval(loadOrders, 8000);

// Check server info (read-only deployments on platforms like Vercel)
async function checkServerInfo() {
  try {
    const res = await fetch('/api/server-info');
    if (!res.ok) return;
    const info = await res.json();
    if (info.readOnlyFiles) {
      if (statusMsg) statusMsg.innerHTML = '<strong style="color:#b71c1c">Eslatma:</strong> Bu muhit yozish uchun mos emas (suziladigan hosting). Mahsulotlar va buyurtmalarni tahrirlash uchun MONGODB_URI sozlang.';
      showToast({ message: 'Server deployi read-only rejimda: MONGODB_URI sozlang persistence uchun', type: 'warning', timeout: 8000 });
    }
  } catch (err) {
    // ignore
  }
}

checkServerInfo();

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
