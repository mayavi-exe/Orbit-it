import { Router } from "express";
import { db, usersTable, collegesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { z } from "zod";

const router = Router();

function mapUserToProfile(user: typeof usersTable.$inferSelect, college: typeof collegesTable.$inferSelect | null) {
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 20);
}

async function generateUniqueUsername(name: string): Promise<string> {
  const base = slugify(name) || "user";
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = attempt === 0 ? "" : `.${Math.floor(1000 + Math.random() * 9000)}`;
    const candidate = `${base}${suffix}`;
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, candidate)).limit(1);
    if (!existing) return candidate;
  }
  return `${base}.${Date.now().toString().slice(-6)}`;
}

const provisionSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  collegeId: z.string().uuid(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9._]+$/).optional(),
});

router.post("/auth/provision", async (req, res) => {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    return;
  }

  const parsed = provisionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }

  const { name, email, collegeId, username: requestedUsername } = parsed.data;

  const [existing] = await db.select().from(usersTable)
    .where(eq(usersTable.clerkId, clerkUserId))
    .limit(1);

  if (existing) {
    const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, existing.collegeId)).limit(1);
    res.json({ user: mapUserToProfile(existing, college ?? null) });
    return;
  }

  const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, collegeId)).limit(1);
  if (!college) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "College not found" });
    return;
  }

  let username: string;
  if (requestedUsername) {
    const [taken] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, requestedUsername)).limit(1);
    if (taken) {
      res.status(409).json({ error: "CONFLICT", message: "Username already taken" });
      return;
    }
    username = requestedUsername;
  } else {
    username = await generateUniqueUsername(name);
  }

  const [emailExists] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (emailExists) {
    const [updated] = await db.update(usersTable)
      .set({ clerkId: clerkUserId })
      .where(eq(usersTable.id, emailExists.id))
      .returning();
    if (updated) {
      const [c] = await db.select().from(collegesTable).where(eq(collegesTable.id, updated.collegeId)).limit(1);
      res.json({ user: mapUserToProfile(updated, c ?? null) });
    }
    return;
  }

  const [user] = await db.insert(usersTable).values({
    clerkId: clerkUserId,
    name,
    username,
    email,
    collegeId,
    passwordHash: null,
    isEmailVerified: true,
  }).returning();

  res.status(201).json({ user: mapUserToProfile(user, college) });
});

export default router;
