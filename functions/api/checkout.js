import { json, fail, now, cleanExpired, shipping } from "../_lib.js";
export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return fail("Database not configured", 503);
    const data = await request.json();
    const { customer, items, method } = data;
    if (
      !customer ||
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 10 ||
      !["paypal", "etransfer"].includes(method)
    )
      return fail("Invalid order");
    for (const k of [
      "name",
      "email",
      "country",
      "address",
      "city",
      "region",
      "postal",
    ])
      if (
        typeof customer[k] !== "string" ||
        !customer[k].trim() ||
        customer[k].length > 180
      )
        return fail("Complete all shipping fields");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email))
      return fail("Invalid email");
    const country = customer.country.toUpperCase();
    if (!/^[A-Z]{2}$/.test(country))
      return fail("Use a two-letter country code");
    if (method === "etransfer" && country !== "CA")
      return fail("Interac e-Transfer is available only for Canada");
    if (
      method === "paypal" &&
      (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET)
    )
      return fail("PayPal is not configured", 503);
    if (method === "etransfer" && !env.ETRANSFER_EMAIL)
      return fail("Interac is not configured", 503);
    const grouped = new Map();
    for (const i of items) {
      if (
        typeof i.id !== "string" ||
        !Number.isInteger(i.qty) ||
        i.qty < 1 ||
        i.qty > 10
      )
        return fail("Invalid quantity");
      grouped.set(i.id, (grouped.get(i.id) || 0) + i.qty);
    }
    if (grouped.size > 10 || [...grouped.values()].some((q) => q > 10))
      return fail("Too many items");
    await cleanExpired(env.DB);
    const chosen = [];
    for (const [id, qty] of grouped) {
      const p = await env.DB.prepare(
        "SELECT id,name,price_cents,stock FROM products WHERE id=? AND active=1",
      )
        .bind(id)
        .first();
      if (!p || p.stock < qty) return fail("Insufficient stock for " + id, 409);
      chosen.push({ ...p, qty });
    }
    const subtotal = chosen.reduce((s, p) => s + p.price_cents * p.qty, 0),
      ship = shipping(country, env);
    if (!Number.isInteger(ship) || ship < 0)
      return fail("Shipping is not configured", 503);
    const id = "PR-" + crypto.randomUUID().slice(0, 8).toUpperCase(),
      t = now(),
      expiry = t + (method === "etransfer" ? 3600 : 900);
    // D1 batch is transactional. Order insertion gates every subsequent stock change.
    const predicates = chosen
      .map(() => "(SELECT stock FROM products WHERE id=? AND active=1)>=?")
      .join(" AND ");
    const args = chosen.flatMap((p) => [p.id, p.qty]);
    const stmts = [
      env.DB.prepare(
        `INSERT INTO orders(id,email,customer_name,country,address,city,region,postal,method,status,total_cents,shipping_cents,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,?,'pending',?,?,?,? WHERE ${predicates}`,
      ).bind(
        id,
        customer.email.trim(),
        customer.name.trim(),
        country,
        customer.address.trim(),
        customer.city.trim(),
        customer.region.trim(),
        customer.postal.trim(),
        method,
        subtotal + ship,
        ship,
        t,
        expiry,
        ...args,
      ),
      ...chosen.map((p) =>
        env.DB.prepare(
          "UPDATE products SET stock=stock-? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=?)",
        ).bind(p.qty, p.id, id),
      ),
      ...chosen.map((p) =>
        env.DB.prepare(
          "INSERT INTO order_items(order_id,product_id,product_name,qty,price_cents) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=?)",
        ).bind(id, p.id, p.name, p.qty, p.price_cents, id),
      ),
    ];
    const results = await env.DB.batch(stmts);
    if (results[0].meta.changes !== 1)
      return fail("Some items just sold out. Refresh and retry.", 409);
    return json({
      id,
      total_cents: subtotal + ship,
      expires_at: expiry,
      method,
      etransfer_email: method === "etransfer" ? env.ETRANSFER_EMAIL : undefined,
    });
  } catch (e) {
    return fail("Could not place order. Please retry.", 500);
  }
}
