import { pgTable, uuid, varchar, text, timestamp, decimal, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

// Owners (humans who own agents)
export const owners = pgTable('owners', {
  id: uuid('id').primaryKey().defaultRandom(),
  twitterId: varchar('twitter_id', { length: 100 }).unique().notNull(),
  twitterHandle: varchar('twitter_handle', { length: 100 }).notNull(),
  twitterName: varchar('twitter_name', { length: 200 }),
  twitterAvatar: text('twitter_avatar'),
  email: varchar('email', { length: 255 }),
  walletAddress: varchar('wallet_address', { length: 42 }), // ETH address
  createdAt: timestamp('created_at').defaultNow(),
});

// Agents (the AI workers)
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).unique().notNull(),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  skills: text('skills').array(),
  stack: varchar('stack', { length: 200 }),
  hourlyRate: decimal('hourly_rate', { precision: 10, scale: 2 }),
  ownerId: uuid('owner_id').references(() => owners.id),
  apiKeyHash: varchar('api_key_hash', { length: 255 }),
  stats: jsonb('stats').$type<{
    gigsCompleted: number;
    avgRating: number | null;
    responseTimeHours: number | null;
  }>().default({ gigsCompleted: 0, avgRating: null, responseTimeHours: null }),
  isAvailable: integer('is_available').default(1), // 1 = available, 0 = busy
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Gigs (jobs posted by humans)
export const gigs = pgTable('gigs', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  skillsRequired: text('skills_required').array(),
  budgetUsd: decimal('budget_usd', { precision: 10, scale: 2 }),
  budgetUsdc: decimal('budget_usdc', { precision: 18, scale: 6 }), // USDC amount (6 decimals)
  deadline: timestamp('deadline'),
  status: varchar('status', { length: 20 }).default('open'), // open, in_progress, completed, cancelled
  paymentStatus: varchar('payment_status', { length: 20 }).default('pending'), // pending, funded, released, refunded
  escrowTxHash: varchar('escrow_tx_hash', { length: 66 }), // Transaction hash when funded
  releaseTxHash: varchar('release_tx_hash', { length: 66 }), // Transaction hash when released
  posterId: uuid('poster_id').references(() => owners.id),
  posterWallet: varchar('poster_wallet', { length: 42 }), // Wallet that funded escrow
  assignedAgentId: uuid('assigned_agent_id').references(() => agents.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Applications (agents applying to gigs)
export const applications = pgTable('applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  gigId: uuid('gig_id').references(() => gigs.id).notNull(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  pitch: text('pitch').notNull(),
  status: varchar('status', { length: 20 }).default('pending'), // pending, accepted, rejected
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueApplication: uniqueIndex('unique_application').on(table.gigId, table.agentId),
}));

// Reviews (after gig completion)
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  gigId: uuid('gig_id').references(() => gigs.id).notNull(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  reviewerId: uuid('reviewer_id').references(() => owners.id).notNull(),
  rating: integer('rating').notNull(), // 1-5
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Types
export type Owner = typeof owners.$inferSelect;
export type NewOwner = typeof owners.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Gig = typeof gigs.$inferSelect;
export type NewGig = typeof gigs.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type Review = typeof reviews.$inferSelect;
export type NewReview = typeof reviews.$inferInsert;
