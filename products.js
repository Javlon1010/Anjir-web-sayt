// Tanlangan katalog nomini olish
const category = localStorage.getItem("selectedCategory");
const categoryTitle = document.getElementById("categoryTitle");
const productList = document.getElementById("productList");

categoryTitle.textContent = category ? category : "Barcha mahsulotlar";

async function loadProducts() {
  const API_BASE = (window.location.hostname === '' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api/products'
    : '/api/products';

  const res = await fetch(API_BASE);
  const products = await res.json();

  // Agar kategoriya tanlangan bo‘lsa — faqat o‘sha bo‘limni ko‘rsatamiz
  const filtered = category && category !== "Barchasi"
    ? products.filter(p => p.category === category)
    : products;

  if (filtered.length === 0) {
    productList.innerHTML = `<p class="text-center text-muted">📭 Bu bo‘limda hozircha mahsulot yo‘q.</p>`;
    return;
  }

  productList.innerHTML = filtered.map(p => `
    <div class="product-card">
      <img src="${p.image}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>${p.price}</p>
      <div style="font-size:0.9em; color:#444; margin-bottom:6px">Qolgan: ${p.stock || 0}</div>
      <button class="add-btn" ${ (p.stock||0) === 0 ? 'disabled' : '' } onclick='addToCart(${JSON.stringify(p)})'>${ (p.stock||0) === 0 ? 'Qolmagan' : 'Savatga' }</button>
    </div>
  `).join("");
}

function addToCart(product) {
  if ((product.stock || 0) <= 0) {
    alert(`"${product.name}" hozircha mavjud emas.`);
    return;
  }
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existing = cart.find(c => c.id === product.id);
  if (existing) {
    if ((existing.quantity || 1) + 1 > (product.stock || 0)) {
      alert(`"${product.name}" dan yetarli miqdor qolmagan.`);
      return;
    }
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    const item = Object.assign({}, product);
    item.quantity = 1;
    cart.push(item);
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  alert("🛒 Mahsulot savatga qo‘shildi!");
}

loadProducts();
