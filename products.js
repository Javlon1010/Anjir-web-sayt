// Tanlangan katalog nomini olish
const category = localStorage.getItem("selectedCategory");
const categoryTitle = document.getElementById("categoryTitle");
const productList = document.getElementById("productList");

categoryTitle.textContent = category ? category : "Barcha mahsulotlar";

async function loadProducts() {
  const API_BASE = (window.location.hostname === '' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api/products'
    : '/api/products';

  try {
    const res = await fetch(API_BASE);
    const products = await res.json();

    // Filter by category if selected
    const filtered = category && category !== "Barchasi"
      ? products.filter(p => p.category === category)
      : products;

    if (filtered.length === 0) {
      productList.innerHTML = `<p class="text-center text-muted">📭 Bu bo'limda hozircha mahsulot yo'q.</p>`;
      return;
    }

    // Group by out of stock status
    const outOfStockProducts = filtered.filter(p => p.outOfStock || p.quantity <= 0);
    const inStockProducts = filtered.filter(p => !p.outOfStock && p.quantity > 0);

    // Display in-stock products first
    let html = '';
    
    if (inStockProducts.length > 0) {
      html += inStockProducts.map(p => `
        <div class="product-card">
          <img src="${p.image}" alt="${p.name}" onerror="this.src='img/placeholder.png'">
          <h3>${p.name}</h3>
          <p class="price">${p.price} so'm</p>
          <div class="stock-info">
            <span class="stock-badge ${p.quantity <= 3 ? 'low-stock' : ''}">
              Qolgan: ${p.quantity} ta
            </span>
          </div>
          <button class="add-btn" onclick='addToCart(${JSON.stringify(p)})'>
            Savatga qo'shish
          </button>
        </div>
      `).join('');
    }

    // Display out-of-stock products with a different style
    if (outOfStockProducts.length > 0) {
      html += `
        <div class="out-of-stock-section">
          <h3>Tugagan mahsulotlar</h3>
          <div class="out-of-stock-grid">
            ${outOfStockProducts.map(p => `
              <div class="product-card out-of-stock">
                <img src="${p.image}" alt="${p.name}" onerror="this.src='img/placeholder.png'">
                <h3>${p.name}</h3>
                <p class="price">${p.price} so'm</p>
                <div class="out-of-stock-badge">Tugagan</div>
                <button class="add-btn" disabled>
                  Mavjud emas
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    productList.innerHTML = html;
  } catch (error) {
    console.error('Error loading products:', error);
    productList.innerHTML = `
      <div class="error-message">
        <p>Mahsulotlarni yuklashda xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.</p>
        <button onclick="location.reload()">Qayta yuklash</button>
      </div>
    `;
  }
}

function addToCart(product) {
  if (product.outOfStock || product.quantity <= 0) {
    showToast({ message: `Kechirasiz, "${product.name}" hozirda sotuvda mavjud emas.`, type: 'error' });
    return;
  }
  
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existingItem = cart.find(item => item.id === product.id);
  
  if (existingItem) {
    if (existingItem.quantity >= product.quantity) {
      showToast({ 
        message: `Kechirasiz, "${product.name}" dan faqat ${product.quantity} ta mavjud.`, 
        type: 'warning' 
      });
      return;
    }
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      quantity: 1,
      maxQuantity: product.quantity
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  
  showToast({ 
    message: `🛒 "${product.name}" savatga qo'shildi!`, 
    type: 'success' 
  });
}

// Update cart count in the header
function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    cartCount.textContent = totalItems;
    cartCount.style.display = totalItems > 0 ? 'inline-block' : 'none';
  }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
  loadProducts();
  updateCartCount();
});
