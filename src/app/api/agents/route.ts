import { NextResponse } from 'next/server';
import { db, agents, owners } from '@/db';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  rateLimit,
  rateLimitResponse,
  validationErrorResponse,
  getClientIP,
  parseBodyWithLimit,
  isValidSlug,
  sanitizeString,
  validateSkills,
  validateHourlyRate,
  isValidTwitterHandle,
} from '@/lib/security';

export async function GET(request: Request) {
  // Rate limit
  const ip = getClientIP(request);
  const limit = rateLimit(ip, 'GET:/api/agents');
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetIn);
  }

  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill');
    const available = searchParams.get('available');

    let query = db.select().from(agents);
    const allAgents = await query;

    let filteredAgents = allAgents;

    // Filter by skill
    if (skill) {
      const sanitizedSkill = sanitizeString(skill, 50);
      filteredAgents = filteredAgents.filter(a => a.skills?.includes(sanitizedSkill));
    }

    // Filter by availability
    if (available === 'true') {
      filteredAgents = filteredAgents.filter(a => a.isAvailable === 1);
    }

    // Remove sensitive fields
    const safeAgents = filteredAgents.map(a => ({
      ...a,
      apiKeyHash: undefined,
    }));

    return NextResponse.json({
      success: true,
      agents: safeAgents,
      total: safeAgents.length,
    }, {
      headers: {
        'X-RateLimit-Remaining': String(limit.remaining),
      }
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Rate limit by IP
  const ip = getClientIP(request);
  const limit = rateLimit(ip, 'POST:/api/agents');
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetIn);
  }

  // Parse body with size limit
  const parsed = await parseBodyWithLimit(request, 5 * 1024); // 5KB max
  if (!parsed.ok) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const body = parsed.body as Record<string, unknown>;
    
    // Extract and validate fields
    const name = sanitizeString(String(body.name || ''), 100);
    const slug = String(body.slug || '').toLowerCase().trim();
    const bio = sanitizeString(String(body.bio || ''), 500);
    const skills = validateSkills(body.skills);
    const stack = sanitizeString(String(body.stack || ''), 200);
    const hourlyRate = validateHourlyRate(body.hourlyRate);
    const twitterHandle = String(body.twitterHandle || '').replace('@', '').trim();

    // Validate required fields
    if (!name || name.length < 2) {
      return validationErrorResponse('Name is required (min 2 characters)');
    }

    if (!slug || !isValidSlug(slug)) {
      return validationErrorResponse(
        'Invalid slug. Use 3-50 lowercase letters, numbers, and hyphens. Must start and end with letter/number.'
      );
    }

    if (twitterHandle && !isValidTwitterHandle(twitterHandle)) {
      return validationErrorResponse('Invalid Twitter handle format');
    }

    // Check if slug already exists
    const existing = await db.select().from(agents).where(eq(agents.slug, slug));
    if (existing.length > 0) {
      return validationErrorResponse('An agent with this slug already exists');
    }

    // Generate API key
    const apiKey = `agw_${randomUUID().replace(/-/g, '')}`;
    const apiKeyHash = await bcrypt.hash(apiKey, 10);

    // Create owner if twitter handle provided
    let ownerId = null;
    if (twitterHandle) {
      const existingOwner = await db.select().from(owners).where(eq(owners.twitterHandle, twitterHandle));
      
      if (existingOwner.length > 0) {
        ownerId = existingOwner[0].id;
      } else {
        const newOwner = await db.insert(owners).values({
          twitterId: `pending_${twitterHandle}`,
          twitterHandle: twitterHandle,
        }).returning();
        ownerId = newOwner[0].id;
      }
    }

    // Create agent
    const newAgent = await db.insert(agents).values({
      name,
      slug,
      bio: bio || null,
      skills,
      stack: stack || null,
      hourlyRate,
      ownerId,
      apiKeyHash,
      stats: { gigsCompleted: 0, avgRating: null, responseTimeHours: null },
      isAvailable: 1,
    }).returning();

    return NextResponse.json({
      success: true,
      message: 'Agent registered successfully!',
      agent: {
        ...newAgent[0],
        apiKeyHash: undefined,
      },
      apiKey, // Return plain API key once
      warning: 'Save your API key now! It cannot be recovered.',
    }, {
      headers: {
        'X-RateLimit-Remaining': String(limit.remaining),
      }
    });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
