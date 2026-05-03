import { Router } from "express";
import { db, usersTable, collegesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/auth.js";
import { z } from "zod";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  collegeId: z.string().uuid(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9._]+$/).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

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

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }

  const { name, email, password, collegeId, username: requestedUsername } = parsed.data;

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "CONFLICT", message: "Email already registered" });
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

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ name, username, email, passwordHash, collegeId }).returning();

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));

  res.status(201).json({ accessToken, refreshToken, user: mapUserToProfile(user, college) });
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid credentials" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "FORBIDDEN", message: "Account banned" });
    return;
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  await db.update(usersTable).set({ refreshToken, lastActiveAt: new Date() }).where(eq(usersTable.id, user.id));

  const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, user.collegeId)).limit(1);
  res.json({ accessToken, refreshToken, user: mapUserToProfile(user, college ?? null) });
});

router.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "refreshToken required" });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);
    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid refresh token" });
      return;
    }

    const newAccess = signAccessToken({ userId: user.id, email: user.email });
    const newRefresh = signRefreshToken({ userId: user.id, email: user.email });
    await db.update(usersTable).set({ refreshToken: newRefresh }).where(eq(usersTable.id, user.id));

    const [college] = await db.select().from(collegesTable).where(eq(collegesTable.id, user.collegeId)).limit(1);
    res.json({ accessToken: newAccess, refreshToken: newRefresh, user: mapUserToProfile(user, college ?? null) });
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid refresh token" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (refreshToken) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      await db.update(usersTable).set({ refreshToken: null }).where(eq(usersTable.id, payload.userId));
    } catch {
      // ignore
    }
  }
  res.json({ success: true, message: "Logged out" });
});

export default router;
