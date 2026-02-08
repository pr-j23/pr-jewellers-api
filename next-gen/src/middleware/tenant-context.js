const TENANT_CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

const parseRegistry = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse TENANT_REGISTRY_JSON', error);
    return null;
  }
};

const getDefaultTenant = (env) => {
  const apiKey = env.DEFAULT_TENANT_API_KEY || 'dev-default-key';
  return {
    displayName: 'Default Tenant',
    dbBinding: 'DB',
    bucketBinding: 'BUCKET',
    apiKeys: [apiKey],
    modules: ['products'],
    featureFlags: {},
    storagePrefix: 'default',
  };
};

const cacheTenant = (tenantId, config) => {
  TENANT_CACHE.set(tenantId, { config, cachedAt: Date.now() });
  return config;
};

const loadTenantConfig = async (c, tenantId) => {
  const cached = TENANT_CACHE.get(tenantId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.config;
  }

  if (c.env.TENANT_REGISTRY && typeof c.env.TENANT_REGISTRY.get === 'function') {
    const kvValue = await c.env.TENANT_REGISTRY.get(tenantId);
    if (kvValue) {
      try {
        const parsed = JSON.parse(kvValue);
        return cacheTenant(tenantId, parsed);
      } catch (error) {
        console.warn(`Invalid JSON for tenant ${tenantId} in KV`, error);
      }
    }
  }

  const envRegistry = parseRegistry(c.env.TENANT_REGISTRY_JSON);
  if (envRegistry?.[tenantId]) {
    return cacheTenant(tenantId, envRegistry[tenantId]);
  }

  if (tenantId === 'default') {
    return cacheTenant(tenantId, getDefaultTenant(c.env));
  }

  return null;
};

export const tenantMiddleware = () => async (c, next) => {
  const tenantHeader = c.req.header('x-tenant-id');
  if (!tenantHeader) {
    return c.json({ status: 'error', message: 'Missing X-Tenant-ID header' }, 400);
  }

  if (!/^\d+$/.test(tenantHeader)) {
    return c.json({ status: 'error', message: 'X-Tenant-ID must be a numeric string' }, 400);
  }

  const tenantId = tenantHeader;

  const tenantConfig = await loadTenantConfig(c, tenantId);
  if (!tenantConfig) {
    console.warn(`Tenant not found: ${tenantId}`);
    return c.json({ status: 'error', message: `Unknown tenant: ${tenantId}` }, 401);
  }

  const context = {
    id: Number(tenantId),
    key: tenantId,
    name: tenantConfig.tenantName || tenantConfig.displayName || `Tenant ${tenantId}`,
    ...tenantConfig,
  };

  c.set('tenant', context);
  await next();
};
