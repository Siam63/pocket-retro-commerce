CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', price_cents INTEGER NOT NULL CHECK(price_cents>=0), stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), image TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, customer_name TEXT NOT NULL, country TEXT NOT NULL, address TEXT NOT NULL, city TEXT NOT NULL, region TEXT NOT NULL, postal TEXT NOT NULL,
 method TEXT NOT NULL CHECK(method IN ('paypal','etransfer')),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','completed','cancelled','expired')),
 total_cents INTEGER NOT NULL, shipping_cents INTEGER NOT NULL DEFAULT 0,
 paypal_order_id TEXT UNIQUE, paypal_capture_id TEXT UNIQUE,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, paid_at INTEGER, tracking TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS order_items (order_id TEXT NOT NULL, product_id TEXT NOT NULL, product_name TEXT NOT NULL, qty INTEGER NOT NULL, price_cents INTEGER NOT NULL, PRIMARY KEY(order_id, product_id));
CREATE INDEX IF NOT EXISTS orders_status_expiry ON orders(status,expires_at);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at DESC);
INSERT OR IGNORE INTO products(id,name,description,price_cents,stock,image,sort_order) VALUES
('green','Transparent Green','R36S handheld • 64GB • retro gaming',5000,0,'/images/green.svg',1),
('blue','Transparent Blue','R36S handheld • 64GB • retro gaming',5000,0,'/images/blue.svg',2),
('tblack','Transparent Black','R36S handheld • 64GB • retro gaming',5500,0,'/images/black.svg',3),
('purple','Transparent Purple','R36S handheld • 64GB • retro gaming',5000,0,'/images/purple.svg',4),
('red','Transparent Red','R36S handheld • 64GB • retro gaming',5000,0,'/images/red.svg',5),
('bundle','Carrying Case + 2 Screen Protectors','Accessory set',1500,0,'/images/case.svg',6);
