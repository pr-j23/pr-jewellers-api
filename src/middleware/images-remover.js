export const imageRemover = () => async (c, next) => {
    const { tableName, id } = c.req.param();

    try {
        const record = await c.env.DB.prepare(`
          SELECT * FROM ${tableName} WHERE id = ?
        `).bind(id).first();

        if (!record) {
            return c.json({ status: 'error', message: `Record not found with id: ${id}` }, 404)
        }

        c.set('record', record);

        await next();
    } catch (error) {
        return c.json({ status: 'error', message: 'Database query failed', error: error.message }, 500);
    }
};