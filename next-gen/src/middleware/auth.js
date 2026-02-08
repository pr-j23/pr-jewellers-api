export const authMiddleware = () => async (c, next) => {
  const tenant = c.get('tenant');
  const providedKey = c.req.header('x-api-key');

  if (!providedKey || !tenant?.apiKeys?.includes(providedKey)) {
    console.warn('Unauthorized access attempt', {
      tenantId: tenant?.id,
      hasKey: Boolean(providedKey),
      path: c.req.path,
    });
    return c.json({ status: 'error', message: 'Unauthorized' }, 401);
  }

  await next();
};
