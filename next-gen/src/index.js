import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { errorHandler } from './middleware/error-handler';
import { tenantMiddleware } from './middleware/tenant-context';
import { authMiddleware } from './middleware/auth';
import { productsRouter } from './routes/products';
import { healthRouter } from './routes/health';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());
app.use('*', errorHandler());

// Health route stays unauthenticated for monitoring.
app.route('/api/health', healthRouter);

// Tenant + auth checks apply to protected routes only.
app.use('/api/products/*', tenantMiddleware());
app.use('/api/products/*', authMiddleware());
app.route('/api/products', productsRouter);

export default app;
