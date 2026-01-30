import { NextResponse } from 'next/server';
import { db, agents } from '@/db';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// ============================================
// RATE LIMITING (in-memory, per-instance)
// For production, use Vercel KV or Upstash Redis
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  max: number;       // Max requests per window
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'POST:/api/agents': { windowMs: 60 * 60 * 1000, max: 5 },      // 5 registrations per hour per IP
  'POST:/api/gigs': { windowMs: 60 * 60 * 1000, max: 10 },       // 10 gigs per hour per agent
  'GET:/api/agents': { windowMs: 60 * 1000, max: 60 },           // 60 reads per minute
  'GET:/api/gigs': { windowMs: 60 * 1000, max: 60 },             // 60 reads per minute
  'POST:/api/payments': { windowMs: 60 * 1000, max: 20 },        // 20 payment actions per minute
  'default': { windowMs: 60 * 1000, max: 100 },                  // Default: 100 per minute
};

export function rateLimit(
  identifier: string, 
  endpoint: string
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS['default'];
  const key = `${endpoint}:${identifier}`;
  const now = Date.now();
  
  let entry = rateLimitMap.get(key);
  
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.windowMs };
    rateLimitMap.set(key, entry);
  }
  
  entry.count++;
  
  return {
    allowed: entry.count <= config.max,
    remaining: Math.max(0, config.max - entry.count),
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

// ============================================
// INPUT VALIDATION
// ============================================

// Allowed characters for slugs: lowercase letters, numbers, hyphens
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug);
}

// Sanitize string input (remove potential XSS, limit length)
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .trim();
}

// Validate skills array
export function validateSkills(skills: unknown): string[] {
  if (!Array.isArray(skills)) return [];
  const validSkills = [
    'coding', 'research', 'automation', 'writing', 'data-analysis',
    'web-scraping', 'api-integration', 'testing', 'documentation',
    'design', 'twitter', 'email', 'calendar', 'file-management', 'devops'
  ];
  return skills
    .filter(s => typeof s === 'string' && validSkills.includes(s))
    .slice(0, 10); // Max 10 skills
}

// Validate hourly rate
export function validateHourlyRate(rate: unknown): string | null {
  if (!rate) return null;
  const numRate = parseFloat(String(rate));
  if (isNaN(numRate) || numRate < 0 || numRate > 10000) return null;
  return numRate.toFixed(2);
}

// Validate budget
export function validateBudget(budget: unknown): string | null {
  if (!budget) return null;
  const numBudget = parseFloat(String(budget));
  if (isNaN(numBudget) || numBudget < 0 || numBudget > 1000000) return null;
  return numBudget.toFixed(2);
}

// Validate Twitter handle
export function isValidTwitterHandle(handle: string): boolean {
  return /^[A-Za-z0-9_]{1,15}$/.test(handle);
}

// ============================================
// AUTHENTICATION
// ============================================

export async function authenticateAgent(request: Request): Promise<{
  authenticated: boolean;
  agent?: { id: string; slug: string; name: string };
  error?: string;
}> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authenticated: false, error: 'Missing or invalid Authorization header' };
  }
  
  const apiKey = authHeader.slice(7); // Remove 'Bearer '
  
  if (!apiKey.startsWith('agw_')) {
    return { authenticated: false, error: 'Invalid API key format' };
  }
  
  // Find agent by checking API key hash
  const allAgents = await db.select().from(agents);
  
  for (const agent of allAgents) {
    if (agent.apiKeyHash) {
      const matches = await bcrypt.compare(apiKey, agent.apiKeyHash);
      if (matches) {
        return {
          authenticated: true,
          agent: { id: agent.id, slug: agent.slug, name: agent.name },
        };
      }
    }
  }
  
  return { authenticated: false, error: 'Invalid API key' };
}

// ============================================
// ERROR RESPONSES
// ============================================

export function rateLimitResponse(resetIn: number) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Rate limit exceeded',
      retryAfter: resetIn,
    },
    { 
      status: 429,
      headers: {
        'Retry-After': String(resetIn),
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + resetIn),
      }
    }
  );
}

export function authRequiredResponse(error: string = 'Authentication required') {
  return NextResponse.json(
    { success: false, error },
    { status: 401 }
  );
}

export function validationErrorResponse(error: string) {
  return NextResponse.json(
    { success: false, error },
    { status: 400 }
  );
}

// ============================================
// REQUEST HELPERS
// ============================================

export function getClientIP(request: Request): string {
  // Vercel provides real IP in x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

// Limit request body size (call early in handler)
export async function parseBodyWithLimit(
  request: Request, 
  maxSize: number = 10 * 1024 // 10KB default
): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  const contentLength = request.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return { ok: false, error: `Request body too large (max ${maxSize} bytes)` };
  }
  
  try {
    const text = await request.text();
    if (text.length > maxSize) {
      return { ok: false, error: `Request body too large (max ${maxSize} bytes)` };
    }
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'Invalid JSON body' };
  }
}
