import { json, fail, requireAdmin, now, cleanExpired } from "../../_lib.js";
export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    await cleanExpired(env.DB);
    const orders = (
      await env.DB.prepare(
        "SELECT * FROM orders ORDER BY created_at DESC LIMIT 200",
      ).all()
    ).results;
    return json({ orders });
  } catch {
    return fail("Unauthorized", 401);
  }
}
export async function onRequestPatch({ request, env }) {
  try {
    await requireAdmin(request, env);
    const { id, status, tracking = "" } = await request.json();
    if (
      !["paid", "shipped", "completed", "cancelled"].includes(status) ||
      typeof id !== "string" ||
      typeof tracking !== "string" ||
      tracking.length > 200
    )
      return fail("Invalid update");
    const o = await env.DB.prepare("SELECT * FROM orders WHERE id=?")
      .bind(id)
      .first();
    if (!o) return fail("Order not found", 404);
    if (
      status === "paid" &&
      (o.method !== "etransfer" || o.status !== "pending")
    )
      return fail("Only pending Interac orders can be manually marked paid");
    if (
      (status === "shipped" && o.status !== "paid") ||
      (status === "completed" && o.status !== "shipped") ||
      (status === "cancelled" && o.status !== "pending")
    )
      return fail("Invalid status transition");
    if (status === "cancelled") {
      const items = (
        await env.DB.prepare("SELECT * FROM order_items WHERE order_id=?")
          .bind(id)
          .all()
      ).results;
      await env.DB.batch([
        ...items.map((x) =>
          env.DB.prepare(
            "UPDATE products SET stock=stock+? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status='pending')",
          ).bind(x.qty, x.product_id, id),
        ),
        env.DB.prepare(
          "UPDATE orders SET status='cancelled' WHERE id=? AND status='pending'",
        ).bind(id),
      ]);
    } else
      await env.DB.prepare(
        "UPDATE orders SET status=?,tracking=?,paid_at=CASE WHEN ?='paid' THEN ? ELSE paid_at END WHERE id=?",
      )
        .bind(status, tracking, status, now(), id)
        .run();
    return json({ ok: true });
  } catch {
    return fail("Unauthorized or invalid update", 401);
  }
}
