import { Hono } from 'hono';
import { StorageService } from '../services/storage-service';
import { parseFormData } from '../middleware/parseData';

const router = new Hono();
const storageService = new StorageService();

router.post('/update/:key', parseFormData, async (c) => {
    const { key } = c.req.param();
    const files = c.get('files');
    if (!files[0]) {
        return c.json({ status: 'error', message: 'Body contains no file of type image/*' }, 400);
    }

    const image = await storageService.uploadFile(c.env.BUCKET, key, files[0].data, files[0].type);
    
    return c.json({ status: 'success', message: 'File updated successfully', updated :image }, 200);
});

router.delete('/delete/:key', async (c) => {
    const { key } = c.req.param();
    await storageService.deleteFile(c.env.BUCKET, key);
    return c.json({ status: 'success', message: 'File deleted successfully' });
});

export { router as storageRouter };