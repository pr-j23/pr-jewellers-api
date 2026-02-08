const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  sku TEXT,
  name TEXT NOT NULL,
  description TEXT,
  price_amount REAL NOT NULL,
  price_currency TEXT NOT NULL DEFAULT 'INR',
  metal TEXT,
  images TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

const CREATE_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_tenant_sku
ON products(tenant_id, sku)
WHERE sku IS NOT NULL;
`;

export class ProductService {
  #initialized = false;

  async ensureSchema(db) {
    if (this.#initialized) return;
    if (typeof db.exec === 'function') {
      await db.exec(CREATE_TABLE_SQL);
      await db.exec(CREATE_UNIQUE_INDEX_SQL);
    } else if (typeof db.prepare === 'function') {
      await db.prepare(CREATE_TABLE_SQL).run();
      await db.prepare(CREATE_UNIQUE_INDEX_SQL).run();
    } else {
      throw new Error('D1 binding does not support exec or prepare');
    }
    this.#initialized = true;
  }

  async findBySku(db, tenantId, sku) {
    if (!sku) return null;
    await this.ensureSchema(db);

    const query = `
      SELECT id FROM products
      WHERE tenant_id = ? AND sku = ?
      LIMIT 1
    `;

    const result = await db.prepare(query).bind(tenantId, sku).first();
    return result || null;
  }

  async createProduct(db, tenantId, payload) {
    await this.ensureSchema(db);

    const {
      name,
      description,
      sku,
      priceAmount,
      priceCurrency,
      metal,
      imagesJson,
    } = payload;

    const query = `
      INSERT INTO products (tenant_id, sku, name, description, price_amount, price_currency, metal, images)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db
      .prepare(query)
      .bind(
        tenantId,
        sku || null,
        name,
        description || null,
        priceAmount,
        priceCurrency,
        metal || null,
        imagesJson || '[]',
      )
      .run();

    return {
      id: result.meta?.last_row_id,
    };
  }

  async listProducts(db, tenantId) {
    await this.ensureSchema(db);

    const query = `
      SELECT id, sku, name, description, price_amount, price_currency, metal, images, created_at, updated_at
      FROM products
      WHERE tenant_id = ?
      ORDER BY updated_at DESC
    `;

    const result = await db.prepare(query).bind(tenantId).all();
    const products = result.results?.map((record) => ({
      id: record.id,
      sku: record.sku,
      name: record.name,
      description: record.description,
      price: {
        currency: record.price_currency,
        amount: record.price_amount,
      },
      metal: record.metal,
      images: (() => {
        try {
          return JSON.parse(record.images || '[]');
        } catch {
          return [];
        }
      })(),
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    })) || [];

    return products;
  }
}
