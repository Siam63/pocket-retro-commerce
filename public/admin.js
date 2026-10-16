const $ = (s) => document.querySelector(s),
  safe = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
async function req(path, method = "GET", body) {
  const r = await fetch(path, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
async function load() {
  try {
    const [p, o] = await Promise.all([
      req("/api/admin/products"),
      req("/api/admin/orders"),
    ]);
    $("#products").innerHTML = p.products
      .map(
        (x) =>
          `<form class="panel" data-product="${safe(x.id)}"><h3>${safe(x.name)}</h3><label>Stock<input name="stock" type="number" min="0" step="1" value="${x.stock}" required></label><label>Price (CAD cents)<input name="price_cents" type="number" min="0" step="1" value="${x.price_cents}" required></label><label><input type="checkbox" name="active" ${x.active ? "checked" : ""} style="width:auto"> Listed on site</label><button class="primary">Save</button><small class="result"></small></form>`,
      )
      .join("");
    document.querySelectorAll("[data-product]").forEach(
      (f) =>
        (f.onsubmit = async (e) => {
          e.preventDefault();
          const el = f.querySelector(".result");
          try {
            await req("/api/admin/products", "PATCH", {
              id: f.dataset.product,
              stock: Number(f.elements.stock.value),
              price_cents: Number(f.elements.price_cents.value),
              active: f.elements.active.checked,
            });
            el.textContent = " Saved";
          } catch (err) {
            el.textContent = err.message;
          }
        }),
    );
    $("#orders").innerHTML = o.orders.length
      ? o.orders
          .map(
            (x) =>
              `<form class="panel" data-order="${safe(x.id)}" style="margin-bottom:12px"><h3>${safe(x.id)} · ${safe(x.status)}</h3><p>${safe(x.customer_name)} · ${safe(x.email)} · ${safe(x.method)} · $${(x.total_cents / 100).toFixed(2)} CAD</p><p>${safe([x.address, x.city, x.region, x.postal, x.country].join(", "))}</p><p>Created: ${new Date(x.created_at * 1000).toLocaleString()} · Expires: ${new Date(x.expires_at * 1000).toLocaleString()}</p><label>New status<select name="status"><option value="paid">Paid (Interac only)</option><option value="shipped">Shipped</option><option value="completed">Completed</option><option value="cancelled">Cancel pending order</option></select></label><label>Tracking<input name="tracking" value="${safe(x.tracking)}"></label><button class="primary">Update order</button><small class="result"></small></form>`,
          )
          .join("")
      : "No orders yet.";
    document.querySelectorAll("[data-order]").forEach(
      (f) =>
        (f.onsubmit = async (e) => {
          e.preventDefault();
          try {
            await req("/api/admin/orders", "PATCH", {
              id: f.dataset.order,
              status: f.elements.status.value,
              tracking: f.elements.tracking.value,
            });
            load();
          } catch (err) {
            f.querySelector(".result").textContent = err.message;
          }
        }),
    );
  } catch (e) {
    $("#products").textContent =
      "Admin access not configured or request failed: " + e.message;
    $("#orders").textContent = "";
  }
}
load();
