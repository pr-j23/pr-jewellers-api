import { Hono } from 'hono';
import { StorageService } from '../services/storage-service';

const router = new Hono();
const storage = new StorageService()

router.get('/:imageName', async (c) => {
    const { imageName } = c.req.param();
    const bucket = c.env.BUCKET
    const object = await storage.getFile(bucket, imageName)

    console.log('Object Image', object, bucket)

    if (object === null) {
        return c.notFound()
    }

    try {
        // Fetch the static asset using the ASSETS binding
        return new Response(object.body, {
            headers: {
                'Content-Type': object.httpMetadata.contentType || 'application/octet-stream',
                'Cache-Control': 'public, max-age=31536000', // 1 year cache
            }
        })
    } catch (err) {
        return c.text('Error fetching image', 500);
    }
});

export { router as imagesRouter };