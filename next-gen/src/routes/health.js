import { Hono } from 'hono';

const router = new Hono();

router.get('/', (c) => {
  return c.json({
    status: 'healthy',
    service: 'next-gen',
    timestamp: new Date().toISOString(),
  });
});

export { router as healthRouter };
