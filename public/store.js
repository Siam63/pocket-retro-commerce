let products = [],
  cart = {};
const $ = (s) => document.querySelector(s),
  fmt = (n) => "$" + (n / 100).toFixed(2) + " CAD";

const safe = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

async function load() {
  try {
    const r = await fetch("/api/products");
    if (!r.ok) throw Error("Inventory unavailable");
    products = (await r.json()).products;
    render();
  } catch (e) {
    $("#products").textContent = e.message;
  }
}

function render() {
  $("#products").innerHTML = products
    .map(
      (p) =>
        `<article class="product"><img src="${safe(p.image)}" alt="${safe(p.name)}" loading="lazy"><h3>${safe(p.name)}</h3><p>${safe(p.description)}</p><div class="price">${fmt(p.price_cents)}</div><span class="stock ${p.stock ? "" : "sold"}">${p.stock ? p.stock + " available" : "Sold out"}</span><button class="primary" data-add="${safe(p.id)}" ${p.stock ? "" : "disabled"}>Add to cart</button></article>`,
    )
    .join("");
  document.querySelectorAll("[data-add]").forEach(
    (b) =>
      (b.onclick = () => {
        const p = products.find((x) => x.id === b.dataset.add);
        if ((cart[p.id] || 0) < p.stock) cart[p.id] = (cart[p.id] || 0) + 1;
        renderCart();
      }),
  );
  renderCart();
}

function renderCart() {
  const entries = Object.entries(cart).filter(([_, q]) => q > 0);
  $("#cart").innerHTML = entries.length
    ? entries
        .map(([id, q]) => {
          const p = products.find((x) => x.id === id);
          return `<div class="cartrow"><span>${safe(p.name)} × ${q}</span><span>${fmt(p.price_cents * q)} <button data-remove="${safe(id)}">−</button></span></div>`;
        })
        .join("")
    : "Your cart is empty.";
  $("#total").textContent = entries.length
    ? "Subtotal: " +
      fmt(
        entries.reduce(
          (s, [id, q]) => s + products.find((p) => p.id === id).price_cents * q,
          0,
        ),
      )
    : "";
  document.querySelectorAll("[data-remove]").forEach(
    (b) =>
      (b.onclick = () => {
        cart[b.dataset.remove]--;
        renderCart();
      }),
  );
}
$("#orderForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = $("#submit"),
    feedback = $("#feedback");
  feedback.textContent = "";
  if (!Object.values(cart).some(Boolean)) {
    feedback.textContent = "Add a product first.";
    return;
  }
  const f = new FormData(e.target);
  const customer = Object.fromEntries(
    ["name", "email", "country", "address", "city", "region", "postal"].map(
      (k) => [k, f.get(k)],
    ),
  );
  if (customer.country === "OTHER") {
    feedback.textContent = "Please contact us for shipping to your country.";
    return;
  }
  const method = f.get("method");
  btn.disabled = true;
  try {
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer,
        method,
        items: Object.entries(cart)
          .filter((x) => x[1] > 0)
          .map(([id, qty]) => ({ id, qty })),
      }),
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error);
    cart = {};
    await load();
    if (method === "etransfer") {
      feedback.textContent = `Order ${d.id} reserved. Total including shipping: ${fmt(d.total_cents)}.\nSend Interac e-Transfer to: ${d.etransfer_email}\nInclude ${d.id} in the message.\nPayment must arrive before ${new Date(d.expires_at * 1000).toLocaleString()}.\nYour order remains PENDING until we verify your bank transfer. Save this order number.`;
    } else {
      feedback.textContent = `Order ${d.id} reserved. Total: ${fmt(d.total_cents)}. Complete PayPal payment below.`;
      const p = await fetch("/api/paypal/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id }),
      });
      const pd = await p.json();
      if (!p.ok) throw Error(pd.error);
      if (!window.paypal)
        throw Error(
          "PayPal SDK not configured. Contact support with order " + d.id,
        );
      $("#paypal-button-container").innerHTML = "";
      window.paypal
        .Buttons({
          createOrder: () => pd.paypal_order_id,
          onApprove: async () => {
            feedback.textContent = "Verifying PayPal payment…";
            const x = await fetch("/api/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: d.id }),
            });
            const v = await x.json();
            feedback.textContent = x.ok
              ? `Payment verified! Order ${d.id} is paid.`
              : `Payment could not be verified automatically. Contact support with order ${d.id}. ${v.error || ""}`;
          },
          onError: () =>
            (feedback.textContent = `PayPal checkout error. Contact support with order ${d.id}.`),
        })
        .render("#paypal-button-container");
    }
  } catch (err) {
    feedback.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
};
$("#orderForm").elements.country.onchange = (e) => {
  if (e.target.value !== "CA") $("#method").value = "paypal";
};
$("#method").onchange = (e) => {
  if (e.target.value === "etransfer")
    $("#orderForm").elements.country.value = "CA";
};
load();

// Smooth section navigation
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', function (event) {
        const targetId = this.getAttribute('href');

        if (!targetId || targetId === '#') return;

        const target = document.querySelector(targetId);
        if (!target) return;

        event.preventDefault();

        const header = document.querySelector('header');
        const offset = header ? header.offsetHeight + 20 : 20;

        const destination =
            target.getBoundingClientRect().top +
            window.scrollY -
            offset;

        window.scrollTo({
            top: Math.max(0, destination),
            behavior: 'smooth'
        });

        history.replaceState(null, '', targetId);
    });
});