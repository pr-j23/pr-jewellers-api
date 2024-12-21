import { Hono } from 'hono';
import { setupMiddleware } from './middleware/setup';
import { tableRouter, storageRouter, healthRouter, imagesRouter } from './routes';

const app = new Hono();

setupMiddleware(app);

// Health Check Endpoint
app.route('/api/health', healthRouter);

// Assets Routing
app.route('/assets/images', imagesRouter)

// API Routes
app.route('/api/tables', tableRouter);
app.route('/api/storage', storageRouter);

export default app;