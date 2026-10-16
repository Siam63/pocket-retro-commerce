export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
export const fail = (msg, status = 400) => json({ error: msg }, status);
export const now = () => Math.floor(Date.now() / 1000);
export async function cleanExpired(db) {
  const t = now();
  const rows = await db
    .prepare(
      "SELECT id FROM orders WHERE status='pending' AND expires_at<? LIMIT 100",
    )
    .bind(t)
    .all();
  for (const row of rows.results) {
    const items = await db
      .prepare("SELECT product_id,qty FROM order_items WHERE order_id=?")
      .bind(row.id)
      .all();
    const stmts = [
      ...items.results.map((x) =>
        db
          .prepare(
            "UPDATE products SET stock=stock+? WHERE id=? AND EXISTS (SELECT 1 FROM orders WHERE id=? AND status='pending' AND expires_at<?)",
          )
          .bind(x.qty, x.product_id, row.id, t),
      ),
      db
        .prepare(
          "UPDATE orders SET status='expired' WHERE id=? AND status='pending' AND expires_at<?",
        )
        .bind(row.id, t),
    ];
    await db.batch(stmts);
  }
}
export function shipping(country, env) {
  return country === "CA"
    ? Number(env.SHIPPING_CA_CENTS || 0)
    : env.SHIPPING_INTL_CENTS && Number(env.SHIPPING_INTL_CENTS) > 0
      ? Number(env.SHIPPING_INTL_CENTS)
      : NaN;
}
export async function paypalToken(env) {
  const base =
    env.PAYPAL_ENV === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  const token = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const r = await fetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + token,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!r.ok) throw new Error("PayPal authentication failed");
  return { base, token: (await r.json()).access_token };
}
export async function paypalRequest(env, path, method, body) {
  const { base, token } = await paypalToken(env);
  const r = await fetch(base + path, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "PayPal-Request-Id": body?.requestId || crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body.data || body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new Error("PayPal request failed: " + (d.message || r.status));
  return d;
}
// Cloudflare Access JWT verification. Never trust identity headers without verifying JWT signature.
export async function requireAdmin(request, env) {
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD)
    throw new Error("Unauthorized");
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Unauthorized");
  const decode = (s) =>
    JSON.parse(atob(s.replace(/-/g, "+").replace(/_/g, "/")));
  const head = decode(parts[0]),
    claims = decode(parts[1]);
  const domain = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, "").replace(
    /\/$/,
    "",
  );
  if (
    head.alg !== "RS256" ||
    claims.iss !== `https://${domain}` ||
    !Array.isArray(claims.aud) ||
    !claims.aud.includes(env.ACCESS_AUD) ||
    claims.exp <= now() ||
    claims.nbf > now()
  )
    throw new Error("Unauthorized");
  const resp = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!resp.ok) throw new Error("Unauthorized");
  const keys = (await resp.json()).keys || [];
  const jwk = keys.find((k) => k.kid === head.kid);
  if (!jwk) throw new Error("Unauthorized");
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sig = Uint8Array.from(
    atob(parts[2].replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    sig,
    new TextEncoder().encode(parts[0] + "." + parts[1]),
  );
  if (!valid) throw new Error("Unauthorized");
  return claims;
}
