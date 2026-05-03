import { Router } from "express";
import { db, usersTable, collegesTable, postsTable, matchesTable, likesTable, commentsTable } from "@workspace/db";
import { eq, and, or, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { z } from "zod";

const router = Router();

function mapPublicProfile(user: typeof usersTable.$inferSelect, college: typeof collegesTable.$inferSelect | null, respectPrivacy = false) {
  const base = {
    id: user.id,
    name: user.name,
    username: user.username ?? null,
    bio: user.bio ?? null,
    profilePhotos: user.profilePhotos,
    collegeId: user.collegeId,
    college: college ? { id: college.id, name: college.name, domain: college.domain, location: college.location } : null,
    interests: user.interests,
    clubs: user.clubs,
    isEmailVerified: user.isEmailVerified,
    profileCompleted: user.profileCompleted,
    gender: (!respectPrivacy || user.showGender) ? (user.gender ?? null) : null,
    age: (!respectPrivacy || user.showAge) ? (user.age ?? null) : null,
  };
  return base;
}

function mapFullProfile(user: typeof usersTable.$inferSelect, college: typeof collegesTable.$inferSelect | null) {
  return {
    id: user.id,
    name: user.name,
    username: user.username ?? null,
    email: user.email,
    bio: user.bio ?? null,
    gender: user.gender ?? null,
    age: user.age ?? null,
    profilePhotos: user.profilePhotos,
    collegeId: user.collegeId,
    college: college ? { id: college.id, name: college.name, domain: college.domain, location: college.location } : null,
    interests: user.interests,
    clubs: user.clubs,
    isEmailVerified: user.isEmailVerified,
    verificationStatus: user.verificationStatus,
    isProfilePublic: user.isProfilePublic,
    showAge: user.showAge,
    showGender: user.showGender,
    profileCompleted: user.profileCompleted,
    isActive: user.isActive,
    lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  bio: z.string().max(300).optional(),
  gender: z.enum(["MALE", "FEMALE", "NON_BINARY", "PREFER_NOT_TO_SAY"]).optional(),
  age: z.number().int().min(16).max(100).optional(),
  interests: z.array(z.string()).optional(),
  clubs: z.array(z.string()).optional(),
  profilePhotos: z.array(z.string()).optional(),
  isProfilePublic: z.boolean().optional(),
  showAge: z.boolean().optional(),
  showGender: z.boolean().optional(),
});

router.get("/users/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, user.collegeId)).limit(1);
  await db.update(usersTable).set({ lastActiveAt: new Date() }).where(eq(usersTable.id, user.id));
  res.json(mapFullProfile(user, college ?? null));
});

router.patch("/users/me/profile", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message }); return; }

  const updates = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const newPhotos = updates.profilePhotos ?? user.profilePhotos;
  const newInterests = updates.interests ?? user.interests;
  const newBio = updates.bio ?? user.bio;
  const profileCompleted = newPhotos.length >= 1 && !!newBio && newInterests.length >= 3;

  const [updated] = await db.update(usersTable)
    .set({ ...updates, profileCompleted, updatedAt: new Date() })
    .where(eq(usersTable.id, req.userId!))
    .returning();

  const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, updated.collegeId)).limit(1);
  res.json(mapFullProfile(updated, college ?? null));
});

router.get("/users/stats", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const [postsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(postsTable).where(eq(postsTable.authorId, userId));
  const [matchesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(matchesTable)
    .where(or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)));
  const [likesReceived] = await db.select({ count: sql<number>`count(*)::int` }).from(likesTable)
    .innerJoin(postsTable, eq(postsTable.id, likesTable.postId))
    .where(eq(postsTable.authorId, userId));
  const [commentsReceived] = await db.select({ count: sql<number>`count(*)::int` }).from(commentsTable)
    .innerJoin(postsTable, eq(postsTable.id, commentsTable.postId))
    .where(eq(postsTable.authorId, userId));

  res.json({
    postsCount: postsCount?.count ?? 0,
    matchesCount: matchesCount?.count ?? 0,
    likesReceived: likesReceived?.count ?? 0,
    commentsReceived: commentsReceived?.count ?? 0,
  });
});

router.get("/users/:userId", requireAuth, async (req, res) => {
  const userId = req.params["userId"] as string;
  const [user] = await db.select().from(usersTable).where(and(eq(usersTable.id, userId), eq(usersTable.isBanned, false))).limit(1);
  if (!user) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, user.collegeId)).limit(1);
  res.json(mapPublicProfile(user, college ?? null, !user.isProfilePublic));
});

router.get("/colleges", async (_req, res) => {
  const colleges = await db.select().from(collegesTable).orderBy(collegesTable.name);
  res.json({ colleges: colleges.map(c => ({ id: c.id, name: c.name, domain: c.domain, location: c.location })) });
});

export { mapPublicProfile };
export default router;
