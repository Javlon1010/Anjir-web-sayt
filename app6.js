// === Savatni localStorage dan olish ===
let cart = JSON.parse(localStorage.getItem("cart")) || [];
const cartContainer = document.getElementById("cartContainer");
const totalPriceEl = document.getElementById("totalPrice");
const clearCartBtn = document.getElementById("clearCart");

// === Mahsulotlarni chiqarish ===
function displayCart() {
  cartContainer.innerHTML = "";

  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="empty-cart">
        <img src="https://cdn-icons-png.flaticon.com/512/11329/11329060.png" alt="Empty cart">
        <p>Savat hozircha bo‘sh...</p>
      </div>`;
    totalPriceEl.textContent = "0 so‘m";
    return;
  }

  let total = 0;
  cart.forEach((item, index) => {
    const card = document.createElement("div");
    card.classList.add("cart-item");
    card.innerHTML = `
      <button class="remove-x" data-index="${index}">✖</button>
      <img src="${item.image}" alt="${item.name}">
      <h3>${item.name}</h3>
      <p>${item.price}</p>
      <div style="display:flex; gap:8px; justify-content:center; align-items:center; margin-top:8px;">
        <label>Son: </label>
        <input type="number" min="1" class="cart-qty" data-index="${index}" value="${item.quantity || 1}" />
      </div>
    `;
    cartContainer.appendChild(card);

    const priceNumber = parseInt(item.price.replace(/[^\d]/g, ""));
    total += priceNumber * (item.quantity || 1);
  });

  totalPriceEl.textContent = `${total.toLocaleString()} so‘m`;

  // Mahsulotni o‘chirish (button)
  document.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = e.target.getAttribute("data-index");
      cart.splice(idx, 1);
      localStorage.setItem("cart", JSON.stringify(cart));
      displayCart();
    });
  });

  // Remove X button
  document.querySelectorAll('.remove-x').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      cart.splice(idx, 1);
      localStorage.setItem('cart', JSON.stringify(cart));
      displayCart();
    });
  });

  // Quantity change
  document.querySelectorAll('.cart-qty').forEach((input) => {
    input.addEventListener('change', (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      const val = Math.max(1, Number(e.target.value || 1));
      cart[idx].quantity = val;
      localStorage.setItem('cart', JSON.stringify(cart));
      displayCart();
    });
  });
}

// === Savatni tozalash ===
clearCartBtn.addEventListener("click", () => {
  if (confirm("Savatni tozalashni xohlaysizmi?")) {
    cart = [];
    localStorage.removeItem("cart");
    displayCart();
  }
});

displayCart();

// === Modalni boshqarish ===
const orderBtn = document.getElementById("orderNow");
const modal = document.getElementById("orderModal");
const closeBtn = document.querySelector(".close-btn");
const orderForm = document.getElementById("orderForm");

orderBtn.addEventListener("click", () => {
  if (cart.length === 0) {
    alert("Savat bo‘sh! Avval mahsulot qo‘shing.");
    return;
  }
  modal.style.display = "flex";
});

// show map preview
const showMapBtn = document.getElementById('showMap');
const mapWrap = document.getElementById('mapPreviewWrap');
const mapIframe = document.getElementById('mapPreview');
showMapBtn?.addEventListener('click', () => {
  const locationVal = document.getElementById('location').value.trim();
  const addressVal = document.getElementById('address').value.trim();
  const q = encodeURIComponent(locationVal || addressVal);
  if (!q) {
    alert('Iltimos avval manzil yoki lokatsiyani kiriting');
    return;
  }
  mapIframe.src = `https://www.google.com/maps?q=${q}&output=embed`;
  mapWrap.style.display = 'block';
});

closeBtn.addEventListener("click", () => (modal.style.display = "none"));
window.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

// === Buyurtmani yuborish ===
orderForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const address = document.getElementById("address").value.trim();

  if (!name || !phone || !address) {
    alert("Iltimos, barcha maydonlarni to‘ldiring!");
    return;
  }

  let total = 0;
  cart.forEach((item) => {
    const priceNum = parseInt(item.price.replace(/[^\d]/g, ""));
    const qty = Number(item.quantity) || 1;
    total += priceNum * qty;
  });

    // 🔹 Serverga yuborish (Telegramga backend orqali)
    const locationVal = document.getElementById('location')?.value.trim();
    fetch((window.location.hostname === 'localhost' || window.location.hostname === '' || window.location.hostname === '127.0.0.1') ? 'http://localhost:3000/api/order' : '/api/order', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        address,
        location: locationVal || '',
        cart,
        total,
      }),
    })
  
    .then(async (res) => {
      if (res.ok) {
        alert("✅ Buyurtmangiz yuborildi! Tez orada siz bilan bog‘lanamiz.");
        localStorage.removeItem("cart");
        cart = [];
        displayCart();
        modal.style.display = "none";
        orderForm.reset();
      } else {
        // server will return JSON error message for stock or validation
        let err;
        try { err = await res.json(); } catch (e) { err = { error: 'Server xatosi' }; }
        alert("❌ Xatolik: " + (err.error || 'Server xatosi'));
      }
    })
    .catch((e) => {
      console.error('Order submit error:', e);
      alert("❌ Tarmoq xatosi. Iltimos qayta urinib ko‘ring.");
    });
});
