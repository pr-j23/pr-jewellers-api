export const validateTable = () => async (c, next) => {
  const { tableName } = c.req.param();

  // Check if table exists
  const tableExists = await c.env.DB.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=?
  `).bind(tableName).first();

  if (!tableExists) {
    return c.json({ status: 'warning', message: 'Table not found' }, 404);
  }

  await next();
};