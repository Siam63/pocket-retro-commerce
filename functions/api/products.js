import { json, cleanExpired } from "../_lib.js";
export async function onRequestGet({ env }) {
  await cleanExpired(env.DB);
  const p = await env.DB.prepare(
    "SELECT id,name,description,price_cents,stock,image FROM products WHERE active=1 ORDER BY sort_order",
  ).all();
  return json({ products: p.results });
}
