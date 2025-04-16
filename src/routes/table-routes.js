import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { TableService } from '../services/table-service';
import { validateTable } from '../middleware/validate-table';
import { SQL_TYPES } from '../config/constants';
import { parseFormData } from '../middleware/parseData';
import { StorageService } from '../services/storage-service';
import { imageRemover } from '../middleware/images-remover';

const router = new Hono();
const tableService = new TableService();
const storage = new StorageService()

const createTableSchema = z.object({
  tableName: z.string().min(1),
  columns: z.array(z.object({
    column_name: z.string(),
    column_type: z.enum([SQL_TYPES.TEXT, SQL_TYPES.INTEGER, SQL_TYPES.REAL, SQL_TYPES.IMAGE_URL, SQL_TYPES.BOOLEAN]),
    nullable: z.boolean().optional()
  })),
});

const addColumnSchema = z.object({
  column_name: z.string(),
  column_type: z.enum([SQL_TYPES.TEXT, SQL_TYPES.INTEGER, SQL_TYPES.REAL, SQL_TYPES.IMAGE_URL, SQL_TYPES.BOOLEAN]),
  nullable: z.boolean().optional()
})

const removeColumnSchema = z.object({
  column_name: z.string(),
})

router.post('/create', zValidator('json', createTableSchema), async (c) => {
  const data = c.req.valid('json');
  try {
    await tableService.createTable(c.env.DB, data.tableName, data.columns);
    return c.json({ status: 'success', message: 'Table created successfully!', note: 'If table already exists, no changed will be made!' });
  }
  catch (error) {
    return c.json({ status: 'error', message: 'Something went wrong or Column name should be unique!', note: 'Column "id" was reserved!' }, 400);
  }
});

router.post('/:tableName/columns', zValidator('json', addColumnSchema), validateTable(), async (c) => {
  const { tableName } = c.req.param();
  const { column_name, column_type, nullable } = await c.req.json();
  try {
    if (column_name === 'id' || column_name === 'created_at' || column_name === 'updated_at') {
      throw Error()
    }
    await tableService.addColumn(c.env.DB, tableName, column_name, column_type, nullable);
    return c.json({ status: 'success', message: 'Column added successfully!' });
  }
  catch (error) {
    return c.json({ status: 'error', message: 'Something went wrong or Column already exists!', note: 'Column "id" was reserved!' }, 400);
  }
});

router.delete('/:tableName/columns', zValidator('json', removeColumnSchema), validateTable(), async (c) => {
  const { tableName } = c.req.param();
  const { column_name } = await c.req.json();
  try {
    if (column_name === 'id' || column_name === 'created_at' || column_name === 'updated_at') {
      throw new Error('Cannot remove the "id", "created_at", "updated_at" column!');
    }
    // Remove the column from the table
    await tableService.removeColumn(c.env.DB, tableName, column_name);
    return c.json({ status: 'success', message: `Column ${column_name} removed successfully!` });
  } catch (error) {
    return c.json({ status: 'error', message: 'Something went wrong or Column does not exist!', note: error.message }, 400);
  }
});

router.post('/:tableName/records', validateTable(), parseFormData, async (c) => {
  const { tableName } = c.req.param();
  const data = c.get('fields');
  const files = c.get('files');

  let file_columns = [];
  let file_data = {};

  const bucket = c.env.BUCKET
  try {
    for (const [key, value] of files.entries()) {
      const file_name = `/assets/images/${Date.now() + '_' + value.filename}`
  
      if (!file_columns.includes(value.fieldname)) {
        file_columns.push(value.fieldname)
      }
  
      if (!file_data[value.fieldname]) {
        file_data[value.fieldname] = [file_name]
      }
      else {
        file_data[value.fieldname].push(file_name)
      }
  
      const image = await storage.uploadFile(bucket, Date.now() + '_' + value.filename, value.data, value.type)
      if (!image) {
        return c.json({ status: 'error', message: 'Error saving image!' }, 400)
      }
    }
  
    for (const [key, value] of file_columns.entries()) {
      const jsonString = JSON.stringify(file_data[value]);
      data[value] = jsonString
    }
  
    const result = await tableService.createRecord(c.env.DB, tableName, data);
    if (!result?.success) {
      return c.json(result, 400);
    }
    return c.json({ status: 'success', message: 'Record added successfully!' });
  }
  catch (error) {
    return c.json({ status: 'error', message: 'Something went wrong or Column does not exist!', note: error.message }, 400);
  }
});

router.get('/:tableName/records', validateTable(), async (c) => {
  const column_types = c.get('column_types')
  const jsonColumns = Object.entries(column_types)
    .filter(([column, type]) => type === "JSONB")
    .map(([column]) => column);
  const { tableName } = c.req.param();
  const result = await tableService.getRecords(c.env.DB, tableName, jsonColumns);
  return c.json({ status: result?.success ? 'success' : 'failed', message: result?.success ? 'Data fetched Successfully!' : 'Something went wrong, please try after sometime!', data: result?.results || [] });
});

router.put('/:tableName/records/:id', validateTable(), parseFormData, imageRemover(), async (c) => {
  const { tableName, id } = c.req.param();
  const { to_delete } = c.req.query();

  let deleteImages = to_delete ? JSON.parse(to_delete) : []
  const toDelete = to_delete ? JSON.parse(to_delete) : []

  deleteImages = deleteImages?.map((img) => {
    return img.split("images/")[1]
  })

  const columns = c.get('column_types')
  const record = c.get('record')
  const image_Columns = Object.keys(columns).map((key) => {
    if (columns[key] === 'JSONB') {
      return key
    }
    return null
  }).filter((value) => value !== null)

  const data = c.get('fields');
  const files = c.get('files');

  let file_columns = [];
  let file_data = {};

  const bucket = c.env.BUCKET
  for (const [key, value] of files.entries()) {

    const file_name = `/assets/images/${Date.now() + '_' + value.filename}`

    if (!file_columns.includes(value.fieldname)) {
      file_columns.push(value.fieldname)
    }

    if (!file_data[value.fieldname]) {
      file_data[value.fieldname] = [file_name]
    }
    else {
      file_data[value.fieldname].push(file_name)
    }

    const image = await storage.uploadFile(bucket, Date.now() + '_' + value.filename, value.data, value.type)
    if (!image) {
      return c.json({ status: 'error', message: 'Error saving image!' }, 400)
    }
  }

  for (const [key, value] of file_columns.entries()) {
    const column = record[value] ? JSON.parse(record[value]).filter((img) => {
      if (toDelete.includes(img)) {
        return false
      }
      return true
    }) : []
    const jsonString = JSON.stringify([...column, ...file_data[value]]);
    data[value] = jsonString
  }

  const result = await tableService.updateRecord(c.env.DB, tableName, id, data);
  if (!result?.success) {
    return c.json(result, 400);
  }

  const recordtoDelete = []

  image_Columns.map((value) => {
    if (!record[value]) return
    const imageColumn = JSON.parse(record[value])
    imageColumn.map((img) => {
      const imageName = img.split("images/")
      if (imageName && deleteImages.includes(imageName[1])) {
        recordtoDelete.push(imageName[1])
      }
    })
  })

  await storage.deleteMultiFile(bucket, recordtoDelete)

  return c.json({ status: 'success', message: 'Record updated successfully!' });
});

router.delete('/:tableName/records/:id', validateTable(), imageRemover(), async (c) => {
  const { tableName, id } = c.req.param();

  const bucket = c.env.BUCKET
  const columns = c.get('column_types')
  const record = c.get('record')
  const image_Columns = Object.keys(columns).map((key) => {
    if (columns[key] === 'JSONB') {
      return key
    }
    return null
  }).filter((value) => value !== null)

  try {

    const result = await tableService.deleteRecord(c.env.DB, tableName, id);
    if (!result?.meta?.changes) {
      return c.json({ status: 'error', message: `Record not found with id: ${id}` }, 404)
    }

    const recordtoDelete = []

    image_Columns.map((value) => {
      if (!record[value]) return
      const imageColumn = JSON.parse(record[value])
      imageColumn.map((img) => {
        const imageName = img.split("images/")

        if (imageName) {
          recordtoDelete.push(imageName[1])
        }
      })
    })

    await storage.deleteMultiFile(bucket, recordtoDelete)

    return c.json({ status: 'success', message: 'Record deleted successfully!' })
  }
  catch (error) {
    return c.json({ status: 'error', message: 'Something went wrong or Column does not exist!', note: error.message }, 400);
  }

});

export { router as tableRouter };