import type { Request } from "react-router";

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(key: string, limit: number = 100, windowMs: number = 15 * 60 * 1000) {
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

export function validateEnvironment() {
  const required = [
    'SHOPIFY_API_KEY',
    'SHOPIFY_API_SECRET',
    'SHOPIFY_APP_URL'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim().slice(0, 1000); // Prevent extremely long strings
  }
  if (Array.isArray(input)) {
    return input.slice(0, 100).map(sanitizeInput); // Limit array size
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    Object.keys(input).slice(0, 50).forEach(key => { // Limit object keys
      sanitized[key] = sanitizeInput(input[key]);
    });
    return sanitized;
  }
  return input;
}