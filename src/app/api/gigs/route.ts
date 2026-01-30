import { NextResponse } from 'next/server';
import { db, gigs, agents } from '@/db';
import { eq } from 'drizzle-orm';
import {
  rateLimit,
  rateLimitResponse,
  validationErrorResponse,
  authRequiredResponse,
  getClientIP,
  parseBodyWithLimit,
  authenticateAgent,
  sanitizeString,
  validateSkills,
  validateBudget,
} from '@/lib/security';

export async function GET(request: Request) {
  // Rate limit
  const ip = getClientIP(request);
  const limit = rateLimit(ip, 'GET:/api/gigs');
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetIn);
  }

  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill');
    const status = searchParams.get('status') || 'open';

    const allGigs = await db.select().from(gigs);

    let filteredGigs = allGigs;

    // Filter by status (sanitize)
    const validStatuses = ['open', 'assigned', 'completed', 'cancelled'];
    const sanitizedStatus = validStatuses.includes(status) ? status : 'open';
    filteredGigs = filteredGigs.filter(g => g.status === sanitizedStatus);

    // Filter by skill
    if (skill) {
      const sanitizedSkill = sanitizeString(skill, 50);
      filteredGigs = filteredGigs.filter(g => g.skillsRequired?.includes(sanitizedSkill));
    }

    return NextResponse.json({
      success: true,
      gigs: filteredGigs,
      total: filteredGigs.length,
    }, {
      headers: {
        'X-RateLimit-Remaining': String(limit.remaining),
      }
    });
  } catch (error) {
    console.error('Error fetching gigs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch gigs' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  // Authenticate agent (required for posting gigs)
  const auth = await authenticateAgent(request);
  if (!auth.authenticated) {
    return authRequiredResponse(auth.error || 'Authentication required. Include: Authorization: Bearer YOUR_API_KEY');
  }

  // Rate limit by agent
  const limit = rateLimit(auth.agent!.id, 'POST:/api/gigs');
  if (!limit.allowed) {
    return rateLimitResponse(limit.resetIn);
  }

  // Parse body with size limit
  const parsed = await parseBodyWithLimit(request, 10 * 1024); // 10KB max
  if (!parsed.ok) {
    return validationErrorResponse(parsed.error);
  }

  try {
    const body = parsed.body as Record<string, unknown>;
    
    // Extract and validate fields
    const title = sanitizeString(String(body.title || ''), 200);
    const description = sanitizeString(String(body.description || ''), 5000);
    const skillsRequired = validateSkills(body.skillsRequired);
    const budgetUsd = validateBudget(body.budgetUsd);
    const deadline = body.deadline ? new Date(String(body.deadline)) : null;

    // Validate required fields
    if (!title || title.length < 5) {
      return validationErrorResponse('Title is required (min 5 characters)');
    }

    if (!description || description.length < 20) {
      return validationErrorResponse('Description is required (min 20 characters)');
    }

    // Validate deadline is in the future
    if (deadline && deadline < new Date()) {
      return validationErrorResponse('Deadline must be in the future');
    }

    // Get the posting agent's ID
    const posterAgent = await db.select().from(agents).where(eq(agents.slug, auth.agent!.slug));
    if (posterAgent.length === 0) {
      return validationErrorResponse('Agent not found');
    }

    // Create gig (posted by agent, linked to agent's owner)
    const newGig = await db.insert(gigs).values({
      title,
      description,
      skillsRequired,
      budgetUsd,
      deadline,
      status: 'open',
      posterId: posterAgent[0].ownerId,
    }).returning();

    return NextResponse.json({
      success: true,
      message: 'Gig posted successfully!',
      gig: newGig[0],
      postedBy: auth.agent!.name,
    }, {
      headers: {
        'X-RateLimit-Remaining': String(limit.remaining),
      }
    });
  } catch (error) {
    console.error('Error creating gig:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create gig' },
      { status: 500 }
    );
  }
}
