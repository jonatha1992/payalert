// Rate Limiter simple en memoria
// NOTA: En producción usar Redis para persistencia entre instancias

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests = new Map<string, RateLimitEntry>();
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 100, windowMs: 60000 }) {
    this.config = config;
    // Limpiar entradas expiradas cada 5 minutos
    setInterval(() => this.cleanup(), 300000);
  }

  // Verificar si el request está permitido
  isAllowed(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // Nueva ventana de tiempo
      const resetTime = now + this.config.windowMs;
      this.requests.set(identifier, {
        count: 1,
        resetTime,
      });
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime,
      };
    }

    // Ventana existente
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  // Limpiar entradas expiradas
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  // Resetear contador para un identificador
  reset(identifier: string) {
    this.requests.delete(identifier);
  }
}

// Instancias predefinidas para diferentes casos de uso
export const webhookRateLimiter = new RateLimiter({
  maxRequests: 100, // 100 requests
  windowMs: 60000,  // por minuto
});

export const apiRateLimiter = new RateLimiter({
  maxRequests: 1000, // 1000 requests
  windowMs: 3600000, // por hora
});

export const authRateLimiter = new RateLimiter({
  maxRequests: 5,   // 5 requests
  windowMs: 60000,  // por minuto
});

export default RateLimiter;
