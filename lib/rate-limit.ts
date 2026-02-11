import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max requests per interval
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting
// In production, consider using Redis or a database
const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Rate limiting middleware for Next.js API routes
 */
export function rateLimit(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Get client identifier (IP address)
    const ip = 
      (request as any).ip || 
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
      request.headers.get('x-real-ip') || 
      'unknown';
    
    const now = Date.now();
    
    // Get or create rate limit entry
    let rateLimitEntry = rateLimitMap.get(ip);
    
    if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
      // Reset or create new entry
      rateLimitEntry = {
        count: 0,
        resetTime: now + config.interval,
      };
      rateLimitMap.set(ip, rateLimitEntry);
    }
    
    // Increment count
    rateLimitEntry.count++;
    
    // Check if limit exceeded
    if (rateLimitEntry.count > config.uniqueTokenPerInterval) {
      const retryAfter = Math.ceil((rateLimitEntry.resetTime - now) / 1000);
      
      return NextResponse.json(
        { 
          error: 'Too many requests', 
          retryAfter,
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.uniqueTokenPerInterval.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitEntry.resetTime).toISOString(),
          },
        }
      );
    }
    
    // Add rate limit headers to successful responses
    const remaining = Math.max(0, config.uniqueTokenPerInterval - rateLimitEntry.count);
    const response = NextResponse.next();
    response.headers.set('X-RateLimit-Limit', config.uniqueTokenPerInterval.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitEntry.resetTime).toISOString());
    
    return null; // No rate limit hit, continue
  };
}

// Cleanup old entries periodically (prevent memory leak)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 60000); // Clean up every minute
}

// Pre-configured rate limiters
export const authRateLimiter = rateLimit({
  interval: 15 * 60 * 1000, // 15 minutes
  uniqueTokenPerInterval: 5, // 5 attempts
});

export const apiRateLimiter = rateLimit({
  interval: 1 * 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 100, // 100 requests
});

export const webhookRateLimiter = rateLimit({
  interval: 1 * 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 300, // 300 requests
});


