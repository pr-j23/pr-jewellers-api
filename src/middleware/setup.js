import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './error-handler';

export const setupMiddleware = (app) => {
	app.use('*', logger());
	app.use('*', cors());
	app.use('*', errorHandler());
};
