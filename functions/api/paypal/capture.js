import { json, fail, paypalRequest, now } from "../../_lib.js";
export async function onRequestPost({ request, env }) {
  try {
    const { id } = await request.json();
    const o = await env.DB.prepare(
      "SELECT * FROM orders WHERE id=? AND method='paypal'",
    )
      .bind(id)
      .first();
    if (!o || !o.paypal_order_id) return fail("Unknown order", 404);
    if (
      o.status === "paid" ||
      o.status === "shipped" ||
      o.status === "completed"
    )
      return json({ status: o.status });
    if (o.status !== "pending" || o.expires_at <= now())
      return fail("Order expired; contact support if payment was made", 409);
    let data;
    try {
      data = await paypalRequest(
        env,
        `/v2/checkout/orders/${encodeURIComponent(o.paypal_order_id)}/capture`,
        "POST",
        { requestId: id + "-capture", data: {} },
      );
    } catch (e) {
      data = await paypalRequest(
        env,
        `/v2/checkout/orders/${encodeURIComponent(o.paypal_order_id)}`,
        "GET",
      );
    }
    const capture = data.purchase_units
      ?.flatMap((u) => u.payments?.captures || [])
      .find((c) => c.status === "COMPLETED");
    if (
      !capture ||
      data.status !== "COMPLETED" ||
      data.id !== o.paypal_order_id ||
      capture.amount?.currency_code !== "CAD" ||
      Math.round(Number(capture.amount.value) * 100) !== o.total_cents ||
      data.purchase_units?.[0]?.custom_id !== id
    )
      return fail("Payment not yet verified. Contact support if charged.", 409);
    await env.DB.prepare(
      "UPDATE orders SET status='paid',paid_at=?,paypal_capture_id=? WHERE id=? AND status='pending'",
    )
      .bind(now(), capture.id, id)
      .run();
    return json({ status: "paid" });
  } catch (e) {
    return fail("Unable to verify payment. Contact support if charged.", 502);
  }
}
