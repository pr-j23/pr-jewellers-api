import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { errorHandler } from './error-handler';
import { config } from '../config/app-config';

export const setupMiddleware = (app) => {
  app.use('*', logger());
  app.use('*', cors({ origin: config.corsOrigins }));
  app.use('*', errorHandler());
};