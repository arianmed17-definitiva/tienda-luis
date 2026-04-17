// ===== SURCO — TIENDA DE VINILOS =====

const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51T9TAUCdA8vpL5CPo3vCGeOUDXjEg4EaRpLPb6d9qwuklkOJcwd8g2dOb2inyhPjbGSTJWPiOI9aDeo1T22Ek09D00c0UTwgo8";
// En Netlify la función vive en /.netlify/functions/
// En localhost apunta al server.js de Express
const IS_LOCALHOST = ["localhost", "127.0.0.1"].includes(location.hostname);
const PAYMENT_URL = IS_LOCALHOST
  ? "http://localhost:8888/create-payment-intent"
  : "/.netlify/functions/create-payment-intent";

// ── Catálogo de productos ────────────────────────────────────────
const PRODUCTS = {
  1: { name: "Kind of Blue", artist: "Miles Davis", price: 89900 },
  2: { name: "Rumours", artist: "Fleetwood Mac", price: 94900 },
  3: { name: "What's Going On", artist: "Marvin Gaye", price: 84900 },
  4: { name: "Nevermind", artist: "Nirvana", price: 99900 },
  5: { name: "Discovery", artist: "Daft Punk", price: 109900 },
  6: { name: "Purple Rain", artist: "Prince", price: 94900 },
};

// ── Estado del carrito ───────────────────────────────────────────
let cart = {}; // { id: { ...product, qty } }

// ── Stripe ──────────────────────────────────────────────────────
let stripe = null;
let cardEl = null;
let stripeReady = false;

// ── Elementos del DOM ────────────────────────────────────────────
const cartFab = document.getElementById("cart-fab");
const cartDrawer = document.getElementById("cart-drawer");
const cartOverlay = document.getElementById("cart-overlay");
const cartClose = document.getElementById("cart-close");
const cartItems = document.getElementById("cart-items");
const cartEmpty = document.getElementById("cart-empty");
const cartFooter = document.getElementById("cart-footer");
const cartCount = document.getElementById("cart-count");
const cartTotal = document.getElementById("cart-total");
const btnPay = document.getElementById("btn-pay");
const payStatus = document.getElementById("pay-status");

// ═══════════════════════════════════════════════════════════════
//  CARRITO
// ═══════════════════════════════════════════════════════════════

function addToCart(id) {
  const product = PRODUCTS[id];
  if (!product) return;

  if (cart[id]) {
    cart[id].qty++;
  } else {
    cart[id] = { ...product, qty: 1 };
  }

  updateCartUI();
  animateCount();

  // Feedback en el botón
  const btn = document.querySelector(`.btn-add[data-id="${id}"]`);
  if (btn) {
    btn.textContent = "✓ Agregado";
    btn.classList.add("added");
    setTimeout(() => {
      btn.textContent = "Agregar al carrito";
      btn.classList.remove("added");
    }, 1800);
  }
}

function removeFromCart(id) {
  delete cart[id];
  updateCartUI();
}

function getCartTotal() {
  return Object.values(cart).reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );
}

function getCartCount() {
  return Object.values(cart).reduce((sum, item) => sum + item.qty, 0);
}

function formatPrice(cents) {
  return (
    "$" + (cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 0 })
  );
}

function updateCartUI() {
  const count = getCartCount();
  const total = getCartTotal();

  cartCount.textContent = count;
  cartTotal.textContent = formatPrice(total);

  const isEmpty = count === 0;
  cartEmpty.style.display = isEmpty ? "flex" : "none";
  cartFooter.style.display = isEmpty ? "none" : "block";

  // Render items
  const existingItems = cartItems.querySelectorAll(".cart-item");
  existingItems.forEach((el) => el.remove());

  Object.values(cart).forEach((item) => {
    const el = document.createElement("div");
    el.className = "cart-item";
    el.innerHTML = `
      <div class="cart-item-disc"></div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-artist">${item.artist}${item.qty > 1 ? ` <span style="color:var(--red)">×${item.qty}</span>` : ""}</div>
      </div>
      <span class="cart-item-price">${formatPrice(item.price * item.qty)}</span>
      <button class="cart-item-remove" data-remove="${Object.keys(cart).find((k) => cart[k] === item)}" title="Eliminar">✕</button>
    `;
    cartItems.insertBefore(el, cartEmpty);
  });

  // Actualizar texto del botón de pago
  if (!isEmpty) {
    btnPay.textContent = `Pagar ${formatPrice(total)}`;
  }
}

function animateCount() {
  cartCount.classList.add("bump");
  setTimeout(() => cartCount.classList.remove("bump"), 300);
}

// ═══════════════════════════════════════════════════════════════
//  DRAWER
// ═══════════════════════════════════════════════════════════════

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  // Inicializar Stripe la primera vez que se abre
  if (!stripeReady) initStripe();
}

function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

// ═══════════════════════════════════════════════════════════════
//  STRIPE
// ═══════════════════════════════════════════════════════════════

function loadStripeJS() {
  return new Promise((resolve, reject) => {
    if (window.Stripe) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://js.stripe.com/v3/";
    s.onload = resolve;
    s.onerror = () => reject(new Error("No se pudo cargar Stripe.js"));
    document.head.appendChild(s);
  });
}

async function initStripe() {
  try {
    await loadStripeJS();
    stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);

    const elements = stripe.elements();
    cardEl = elements.create("card", {
      hidePostalCode: true,
      style: {
        base: {
          color: "#0f0e0b",
          fontFamily: "'DM Mono', 'Courier New', monospace",
          fontSize: "15px",
          fontSmoothing: "antialiased",
          "::placeholder": { color: "#9a9080" },
          iconColor: "#c8311a",
        },
        invalid: { color: "#c8311a", iconColor: "#c8311a" },
      },
    });

    cardEl.mount("#card-element");

    cardEl.on("change", (e) => {
      if (e.error) showPayStatus("error", "⚠ " + e.error.message);
      else if (e.complete) showPayStatus("info", "✔ Tarjeta lista.");
      else hidePayStatus();
    });

    btnPay.disabled = false;
    stripeReady = true;
  } catch (err) {
    showPayStatus("error", "No se pudo cargar Stripe: " + err.message);
  }
}

// ── Submit pago ──────────────────────────────────────────────────
btnPay.addEventListener("click", async () => {
  if (!stripe || !cardEl || getCartCount() === 0) return;

  btnPay.disabled = true;
  btnPay.textContent = "Procesando...";
  showPayStatus("loading", "⏳ Procesando pago...");

  try {
    const name =
      document.getElementById("pay-name").value.trim() || "Cliente SURCO";

    const res = await fetch(PAYMENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: getCartTotal(),
      }),
    });

    const data = await res.json();

    if (data.error) throw new Error(data.error);

    const { error: confirmError } = await stripe.confirmCardPayment(
      data.clientSecret,
      {
        payment_method: {
          card: cardEl,
          billing_details: { name },
        },
      },
    );

    if (confirmError) throw new Error(confirmError.message);

    onPaymentSuccess();
  } catch (err) {
    showPayStatus("error", buildErrorMsg(err.message));
    btnPay.disabled = false;
    btnPay.textContent = `Pagar ${formatPrice(getCartTotal())}`;
  }
});

function onPaymentSuccess(pm) {
  const items = Object.values(cart)
    .map((i) => i.name)
    .join(", ");
  showPayStatus(
    "success",
    `✅ <b>¡Pago completado!</b><br>` +
      `<small>Productos: ${items}</small>` +
      (pm
        ? `<br><small style="opacity:.7">ID: ${pm.id.slice(0, 24)}...</small>`
        : ""),
  );
  confetti();
  cart = {};
  updateCartUI();
  cardEl.clear();
  document.getElementById("pay-name").value = "";
  btnPay.textContent = "Pagar";
}

function buildErrorMsg(msg) {
  const map = {
    card_declined: "❌ Tarjeta rechazada por el banco.",
    insufficient_funds: "❌ Fondos insuficientes.",
    expired_card: "❌ La tarjeta está expirada.",
    incorrect_cvc: "❌ CVC incorrecto.",
    "Your card was declined": "❌ Tarjeta rechazada por el banco.",
    "Your card has insufficient funds": "❌ Fondos insuficientes.",
  };
  for (const [k, v] of Object.entries(map)) {
    if (msg.includes(k)) return v;
  }
  return "❌ " + msg;
}

// ═══════════════════════════════════════════════════════════════
//  UI HELPERS
// ═══════════════════════════════════════════════════════════════

function showPayStatus(type, msg) {
  payStatus.className = "pay-status pay-status--" + type;
  payStatus.innerHTML = msg;
  payStatus.style.display = "block";
}
function hidePayStatus() {
  payStatus.style.display = "none";
}

function confetti() {
  const colors = ["#c8311a", "#0f0e0b", "#b8860b", "#f5f0e8"];
  for (let i = 0; i < 60; i++) {
    const d = document.createElement("div");
    d.style.cssText = `
      position:fixed;pointer-events:none;z-index:9999;
      width:${Math.random() * 8 + 4}px;height:${Math.random() * 8 + 4}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      left:${Math.random() * 100}vw;top:-10px;
      animation:fall ${Math.random() * 2 + 1.5}s ease-in forwards;
      animation-delay:${Math.random() * 0.5}s;
    `;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 4000);
  }
}

// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════

// Botones "Agregar al carrito"
document.querySelectorAll(".btn-add").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    addToCart(parseInt(btn.dataset.id));
  });
});

// Click en tarjeta de producto también abre carrito
document.querySelectorAll(".product-card").forEach((card) => {
  card.addEventListener("click", (e) => {
    if (e.target.closest(".btn-add")) return;
    addToCart(parseInt(card.dataset.id));
  });
});

// Abrir/cerrar carrito
cartFab.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

// Eliminar item del carrito (delegación de eventos)
cartItems.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove]");
  if (btn) removeFromCart(btn.dataset.remove);
});

// Copiar tarjetas de prueba
["tc1", "tc2", "tc3"].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("click", () => {
    navigator.clipboard
      .writeText(el.textContent.replace(/\s/g, ""))
      .then(() => {
        const orig = el.textContent;
        el.textContent = "¡Copiado!";
        setTimeout(() => (el.textContent = orig), 1200);
      });
  });
});

// ── Confetti keyframe (inyectar una sola vez) ────────────────────
const style = document.createElement("style");
style.textContent = `@keyframes fall {
  from { transform: translateY(0) rotate(0deg); opacity: 1; }
  to   { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}`;
document.head.appendChild(style);

// ── Init ─────────────────────────────────────────────────────────
updateCartUI();
