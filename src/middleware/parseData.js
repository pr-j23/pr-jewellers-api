export const parseFormData = async (c, next) => {
    try {
        const data = await c.req.formData();
        const { tableName } = c.req.param();

        const columnDefinitions = await c.env.DB.prepare(`
            PRAGMA table_info(${tableName})
          `).all();

        const columnTypes = columnDefinitions?.results?.reduce((acc, col) => {
            acc[col.name] = col.type; // map column name to its type
            return acc;
        }, {});

        const fields = {};
        const files = [];

        for (const [key, value] of data.entries()) {
            if (value instanceof File) {
                // if (columnTypes[key] !== 'VARCHAR(255)') {
                //     return c.json({ status: 'error', message: `Field ${key} should not contain files or invalid Column` }, 400);
                // } 
                if (value.type.split('/')[0] !== 'image') {
                    return c.json({ status: 'error', message: `Field ${key} should be of type image/* only`, note: 'Upload only files of type image/*' }, 400);
                }
                files.push({
                    fieldname: key,
                    filename: value.name,
                    type: value.type,
                    data: await value.arrayBuffer(), // Convert to ArrayBuffer
                });
            } else {
                if (columnTypes[key] === 'JSONB' && value !==  'no_upload') {
                    return c.json({ status: 'error', message: `Field ${key} should be type image/* only  or invalid Column`, note: 'Upload only files of type image/*' }, 400);
                }
                fields[key] = value;
            }
        }

        // Attach parsed data to context for use in route handler
        c.set('fields', fields);
        c.set('files', files);

        await next(); // Call the next middleware or route handler
    }
    catch (error) {
        return c.json({ status: 'error', message: 'Add appropriate Body to proceed with the operation!' }, 400)
    }

};