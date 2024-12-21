import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { TableService } from '../services/table-service';
import { validateTable } from '../middleware/validate-table';
import { SQL_TYPES } from '../config/constants';
import { parseFormData } from '../middleware/parseData';
import { StorageService } from '../services/storage-service';

const router = new Hono();
const tableService = new TableService();
const storage = new StorageService()

const createTableSchema = z.object({
  tableName: z.string().min(1),
  columns: z.array(z.object({
    column_name: z.string(),
    column_type: z.enum([SQL_TYPES.TEXT, SQL_TYPES.INTEGER, SQL_TYPES.REAL]),
    nullable: z.boolean().optional(),
  })),
});

router.post('/create', zValidator('json', createTableSchema), async (c) => {
  const data = c.req.valid('json');
  await tableService.createTable(c.env.DB, data.tableName, data.columns);
  return c.json({ status: 'success', message: 'Table created successfully!', note: 'If table already exists, no changed will be made!' });
});

router.post('/:tableName/columns', validateTable(), async (c) => {
  const { tableName } = c.req.param();
  const { columnName, columnType } = await c.req.json();
  try {
    await tableService.addColumn(c.env.DB, tableName, columnName, columnType);
    return c.json({ status: 'success', message: 'Column added successfully!' });
  }
  catch (error) {
    return c.json({ status: 'error', message: 'Something went wrong or Column already exists!' }, 400);
  }
});

router.post('/:tableName/records', validateTable(), parseFormData, async (c) => {
  const { tableName } = c.req.param();
  const { overwrite } = c.req.query();
  const data = c.get('fields');
  const files = c.get('files');

  const bucket = c.env.BUCKET
  const object = await storage.getFile(bucket, files[0].filename);

  if (!overwrite && object) {
    return c.json({ status: 'warning', message: `Image asset with name - "${files[0].filename}" already exists!`, note: `set params ?overwrite=true else rename the image` });
  }
  const file_name = `/assets/images/${files[0].filename}`

  data[files[0].fieldname] = file_name;
  const image = await storage.uploadFile(bucket, files[0].filename, files[0].data, files[0].type)
  if (!image) {
    return c.json({ status: 'error', message: 'Error saving image!' }, 400)
  }
  const result = await tableService.createRecord(c.env.DB, tableName, data);
  if (!result?.success) {
    return c.json(result, 400);
  }
  return c.json({ status: 'success', message: 'Record added successfully!' });
});

router.get('/:tableName/records', validateTable(), async (c) => {
  const { tableName } = c.req.param();
  const result = await tableService.getRecords(c.env.DB, tableName);
  return c.json({ status: result?.success ? 'success' : 'failed', message: result?.success ? 'Data fetched Successfully!' : 'Something went wrong, please try after sometime!', data: result?.results || [] });
});

router.put('/:tableName/records/:id', validateTable(), parseFormData, async (c) => {
  const { tableName, id } = c.req.param();
  const data = c.get('fields');
  const files = c.get('files');

  const bucket = c.env.BUCKET
  const object = await storage.getFile(bucket, files[0].filename);

  if (object) {
    return c.json({ status: 'warning', message: `Image asset with name - "${files[0].filename}" already exists!`, note: `To verwrite existing image please use the route '/api/storage/'` });
  }

  const file_name = `/assets/images/${files[0].filename}`

  data[files[0].fieldname] = file_name;
  const image = await storage.uploadFile(bucket, files[0].filename, files[0].data, files[0].type)
  if (!image) {
    return c.json({ status: 'error', message: 'Error saving image!' }, 400)
  }
  const result = await tableService.updateRecord(c.env.DB, tableName, id, data);
  if (!result?.success) {
    return c.json(result, 400);
  }
  return c.json({ status: 'success', message: 'Record updated successfully!' });
});

router.delete('/:tableName/records/:id', validateTable(), async (c) => {
  const { tableName, id } = c.req.param();
  const result = await tableService.deleteRecord(c.env.DB, tableName, id);
  if (!result?.success?.meta?.changes) {
    return c.json({ status: 'error', message: `Record not found with id: ${id}` }, 404)
  }
  return c.json({ status: 'success', message: 'Record deleted successfully!' });
});

export { router as tableRouter };