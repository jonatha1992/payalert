import { NextRequest, NextResponse } from 'next/server';
import RateLimiter from './rateLimiter';

interface RateLimitOptions {
  limiter: RateLimiter;
  getIdentifier?: (req: NextRequest) => string;
}

// Función para obtener IP del request
export function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

// Middleware de rate limiting para API routes
export function withRateLimit(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>,
  options: RateLimitOptions
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const identifier = options.getIdentifier 
      ? options.getIdentifier(req)
      : getClientIP(req);

    const result = options.limiter.isAllowed(identifier);

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later',
          retryAfter,
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
            'Retry-After': retryAfter.toString(),
          },
        }
      );
    }

    // Ejecutar handler
    const response = await handler(req, context);
    
    // Agregar headers de rate limit a la respuesta
    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
    
    return response;
  };
}
