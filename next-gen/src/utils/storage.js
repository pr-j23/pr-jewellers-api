const getUuid = () => {
  const globalCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === 'function') {
    return globalCrypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const normalizeFilename = (name = '') => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
};

export const buildImagePath = (tenantId, filename) => {
  const safeName = normalizeFilename(filename);
  return `${tenantId}/products/${Date.now()}-${getUuid()}-${safeName}`;
};
