import { Hono } from 'hono';
import { z } from 'zod';
import { ProductService } from '../services/product-service';
import { StorageService } from '../services/storage-service';

const router = new Hono();
const productService = new ProductService();
const storageService = new StorageService();

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

const productSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  price: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'Price must be numeric')
    .transform((value) => Number(value)),
  metal: z.string().min(1, 'Metal is required'),
  sku: z.string().min(1).optional(),
  description: z.string().optional(),
  price_currency: z.string().length(3).optional(),
});

const parseMultipart = async (request) => {
  const formData = await request.formData();
  const fields = {};
  const files = [];

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      files.push({
        fieldname: key,
        filename: value.name,
        type: value.type,
        data: await value.arrayBuffer(),
      });
    } else {
      fields[key] = value;
    }
  }

  return { fields, files };
};

router.post('/', async (c) => {
  const { fields, files } = await parseMultipart(c.req);
  const validation = productSchema.safeParse(fields);

  if (!validation.success) {
    return c.json(
      {
        status: 'error',
        message: validation.error.issues.map((issue) => issue.message).join(', '),
      },
      400,
    );
  }

  const tenant = c.get('tenant');
  const bucket = c.env[tenant.bucketBinding || 'BUCKET'];
  const db = c.env[tenant.dbBinding || 'DB'];

  if (files.length > MAX_IMAGES) {
    return c.json(
      { status: 'error', message: `A maximum of ${MAX_IMAGES} images is allowed per product` },
      400,
    );
  }

  const supportedImages = files.filter((file) => file.type.startsWith('image/'));
  if (supportedImages.length !== files.length) {
    return c.json({ status: 'error', message: 'Only image uploads are supported for gallery' }, 400);
  }

  const oversizeImage = supportedImages.find((file) => file.data.byteLength > MAX_IMAGE_BYTES);
  if (oversizeImage) {
    return c.json(
      {
        status: 'error',
        message: `Each image must be ≤ ${MAX_IMAGE_BYTES / (1024 * 1024)}MB`,
        note: `${oversizeImage.filename} is too large`,
      },
      400,
    );
  }

  if (validation.data.sku) {
    const existing = await productService.findBySku(db, tenant.id, validation.data.sku);
    if (existing) {
      return c.json(
        { status: 'error', message: `SKU ${validation.data.sku} already exists for this tenant` },
        409,
      );
    }
  }

  const uploaded = await storageService.uploadGallery(bucket, tenant.storagePrefix || tenant.id, supportedImages);
  const imagesJson = JSON.stringify(uploaded);

  const payload = {
    name: validation.data.name,
    description: validation.data.description,
    sku: validation.data.sku,
    priceAmount: validation.data.price,
    priceCurrency: validation.data.price_currency || 'INR',
    metal: validation.data.metal,
    imagesJson,
  };

  let created;
  try {
    created = await productService.createProduct(db, tenant.id, payload);
  } catch (error) {
    if (error.message?.includes('idx_products_tenant_sku')) {
      return c.json({ status: 'error', message: 'SKU already exists' }, 409);
    }
    console.error('Failed to create product', error);
    return c.json({ status: 'error', message: 'Unable to save product' }, 500);
  }

  return c.json({
    status: 'success',
    message: 'Record added successfully!',
    data: { id: created.id, images: uploaded },
  });
});

router.get('/', async (c) => {
  const tenant = c.get('tenant');
  const db = c.env[tenant.dbBinding || 'DB'];

  const products = await productService.listProducts(db, tenant.id);

  return c.json({
    status: 'success',
    message: 'Products fetched successfully',
    data: products,
  });
});

export { router as productsRouter };
