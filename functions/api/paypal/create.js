import { json, fail, paypalRequest, now } from "../../_lib.js";
export async function onRequestPost({ request, env }) {
  try {
    const { id } = await request.json();
    if (typeof id !== "string") return fail("Invalid order");
    const order = await env.DB.prepare(
      "SELECT * FROM orders WHERE id=? AND method='paypal' AND status='pending'",
    )
      .bind(id)
      .first();
    if (!order || order.expires_at <= now()) return fail("Order expired", 409);
    if (order.paypal_order_id)
      return json({ paypal_order_id: order.paypal_order_id });
    const data = await paypalRequest(env, "/v2/checkout/orders", "POST", {
      requestId: id,
      data: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: id,
            custom_id: id,
            amount: {
              currency_code: "CAD",
              value: (order.total_cents / 100).toFixed(2),
            },
          },
        ],
      },
    });
    await env.DB.prepare(
      "UPDATE orders SET paypal_order_id=? WHERE id=? AND paypal_order_id IS NULL",
    )
      .bind(data.id, id)
      .run();
    return json({ paypal_order_id: data.id });
  } catch (e) {
    return fail("Unable to start PayPal checkout", 502);
  }
}
