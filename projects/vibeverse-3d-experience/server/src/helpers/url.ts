import { Request } from 'express';

/**
 * Get the base URL for the application from the request
 * Works for both localhost development and production deployment (Vercel, etc.)
 */
export function getBaseUrl(req: Request): string {
  // Check if there's an environment variable override
  if (process.env.BASE_URL) {
    return process.env.BASE_URL;
  }
  
  // Build from request headers
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
  const host = req.get('host') || 'localhost:3000';
  
  return `${protocol}://${host}`;
}