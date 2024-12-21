export const parseFormData = async (c, next) => {

    const data = await c.req.formData();
    const fields = {};
    const files = [];

    for (const [key, value] of data.entries()) {
        if (value instanceof File) {
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
            fields[key] = value;
        }
    }

    // Attach parsed data to context for use in route handler
    c.set('fields', fields);
    c.set('files', files);

    await next(); // Call the next middleware or route handler
};