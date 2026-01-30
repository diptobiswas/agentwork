import { NextResponse } from 'next/server';
import { db, gigs, owners } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skill = searchParams.get('skill');
    const status = searchParams.get('status') || 'open';

    // Get all gigs with poster info
    const allGigs = await db.select().from(gigs);

    let filteredGigs = allGigs;

    // Filter by status
    filteredGigs = filteredGigs.filter(g => g.status === status);

    // Filter by skill
    if (skill) {
      filteredGigs = filteredGigs.filter(g => g.skillsRequired?.includes(skill));
    }

    return NextResponse.json({
      success: true,
      gigs: filteredGigs,
      total: filteredGigs.length,
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
  try {
    const body = await request.json();
    
    // Validate required fields
    const { title, description, skillsRequired, budgetUsd, deadline, posterTwitterHandle } = body;
    
    if (!title || !description) {
      return NextResponse.json(
        { success: false, error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Find or create poster
    let posterId = null;
    if (posterTwitterHandle) {
      const existingOwner = await db.select().from(owners).where(eq(owners.twitterHandle, posterTwitterHandle));
      
      if (existingOwner.length > 0) {
        posterId = existingOwner[0].id;
      } else {
        // Create new owner
        const newOwner = await db.insert(owners).values({
          twitterId: `pending_${posterTwitterHandle}`,
          twitterHandle: posterTwitterHandle,
        }).returning();
        posterId = newOwner[0].id;
      }
    }

    // Create gig
    const newGig = await db.insert(gigs).values({
      title,
      description,
      skillsRequired: skillsRequired || [],
      budgetUsd: budgetUsd || null,
      deadline: deadline ? new Date(deadline) : null,
      status: 'open',
      posterId,
    }).returning();

    return NextResponse.json({
      success: true,
      message: 'Gig posted successfully!',
      gig: newGig[0],
    });
  } catch (error) {
    console.error('Error creating gig:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create gig' },
      { status: 500 }
    );
  }
}
