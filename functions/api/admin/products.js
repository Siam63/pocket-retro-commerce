import { json, fail, requireAdmin } from "../../_lib.js";
export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    return json({
      products: (
        await env.DB.prepare("SELECT * FROM products ORDER BY sort_order").all()
      ).results,
    });
  } catch {
    return fail("Unauthorized", 401);
  }
}
export async function onRequestPatch({ request, env }) {
  try {
    await requireAdmin(request, env);
    const p = await request.json();
    if (
      typeof p.id !== "string" ||
      !Number.isInteger(p.stock) ||
      p.stock < 0 ||
      p.stock > 100000 ||
      !Number.isInteger(p.price_cents) ||
      p.price_cents < 0 ||
      p.price_cents > 10000000 ||
      typeof p.active !== "boolean"
    )
      return fail("Invalid product");
    await env.DB.prepare(
      "UPDATE products SET stock=?,price_cents=?,active=? WHERE id=?",
    )
      .bind(p.stock, p.price_cents, p.active ? 1 : 0, p.id)
      .run();
    return json({ ok: true });
  } catch (e) {
    return fail("Unauthorized or invalid update", 401);
  }
}
