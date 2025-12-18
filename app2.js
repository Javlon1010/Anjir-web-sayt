const container = document.getElementById("productContainer");
const searchInput = document.getElementById("searchInput");
const categoryButtons = document.querySelectorAll(".category-btn");
let products = [];

// 🟢 Mahsulotlarni yuklash
async function loadProducts() {
  try {
    const res = await fetch("http://localhost:3000/api/products");
    products = await res.json();
    displayProducts(products);
  } catch (err) {
    container.innerHTML = "<p style='color:red;'>❌ Server bilan aloqa yo‘q!</p>";
  }
}

// 🟢 Mahsulotlarni ko‘rsatish
function displayProducts(filteredProducts = products) {
  container.innerHTML = "";

  if (filteredProducts.length === 0) {
    container.innerHTML = "<p style='text-align:center;'>🕵️‍♂️ Hech narsa topilmadi</p>";
    return;
  }

  filteredProducts.forEach((p, index) => {
    const card = document.createElement("div");
    card.classList.add("product-card");
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}" />
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-price">${p.price}</div>
        <div style="font-size:0.9em; color:#444; margin-top:6px">Qolgan: ${p.stock || 0}</div>
        <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
          <input type="number" min="1" max="${p.stock || 9999}" value="1" class="qty-input" data-index="${index}">
          <button class="add-to-cart" data-index="${index}">🛒 Savatga</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  // 🛒 Savatga qo‘shish (qty qo‘llab-quvvatlanadi)
  document.querySelectorAll(".add-to-cart").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.getAttribute("data-index"));
      const product = filteredProducts[idx];
      const qtyInput = document.querySelector(`.qty-input[data-index="${idx}"]`);
      const qty = Math.max(1, Number(qtyInput?.value || 1));

      const cart = JSON.parse(localStorage.getItem("cart")) || [];
      const existing = cart.find((c) => c.id === product.id);
      const currentQty = existing ? (existing.quantity || 0) : 0;

      // Stock tekshiruvi
      if ((currentQty + qty) > (product.stock || 0)) {
        alert(`Nima tezroq: "${product.name}" dan faqat ${(product.stock || 0) - currentQty} dona qoldi`);
        return;
      }

      if (existing) {
        existing.quantity = currentQty + qty;
      } else {
        const item = Object.assign({}, product);
        item.quantity = qty;
        cart.push(item);
      }

      localStorage.setItem("cart", JSON.stringify(cart));
      alert(`${product.name} x${qty} savatga qo‘shildi!`);
    });
  });
}

// 🔍 Qidiruv
searchInput.addEventListener("input", () => {
  const query = searchInput.value.toLowerCase();
  const selectedCategory = document.querySelector(".category-btn.active")?.dataset.category;

  let filtered = products.filter((p) => p.name.toLowerCase().includes(query));
  if (selectedCategory && selectedCategory !== "Barchasi") {
    filtered = filtered.filter((p) => p.category === selectedCategory);
  }

  displayProducts(filtered);
});

// 🗂 Kategoriya bo‘yicha filtrlash
categoryButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    categoryButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const category = btn.dataset.category;
    if (category === "Barchasi") {
      displayProducts(products);
    } else {
      const filtered = products.filter((p) => p.category === category);
      displayProducts(filtered);
    }
  });
});


// 🔄 Yuklash
loadProducts();
