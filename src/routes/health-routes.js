import { Hono } from 'hono';

const router = new Hono();

router.get('/', async (c) => {
    return c.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

export { router as healthRouter };