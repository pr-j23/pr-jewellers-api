export const validateTable = () => async (c, next) => {
  const { tableName } = c.req.param();

  // Check if table exists
  const tableExists = await c.env.DB.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name=?
  `).bind(tableName).first();

  const columnDefinitions = await c.env.DB.prepare(`
    PRAGMA table_info(${tableName})
  `).all();

  const columnTypes = columnDefinitions?.results?.reduce((acc, col) => {
      acc[col.name] = col.type; // map column name to its type
      return acc;
  }, {});

  c.set('column_types', columnTypes);

  if (!tableExists) {
    return c.json({ status: 'warning', message: 'Table not found' }, 404);
  }

  await next();
};