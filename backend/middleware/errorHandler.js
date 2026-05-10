// backend/middleware/errorHandler.js
import { logError } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Log error
  logError({
    message: err.message || 'Unknown error',
    stack: err.stack,
    endpoint: req.path,
    method: req.method,
    userId: req.user?.id,
    storeId: req.storeId || req.body?.storeId || req.query?.storeId,
    body: isDevelopment ? req.body : undefined,
    query: req.query
  });
  
  const statusCode = err.status || err.statusCode || 500;
  
  res.status(statusCode).json({
    error: isDevelopment ? err.message : 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }),
    ...(err.code && { code: err.code })
  });
}


