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

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }

  const { name, email, password, collegeId } = parsed.data;

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "CONFLICT", message: "Email already registered" });
    return;
  }

  const college = await db.select().from(collegesTable).where(eq(collegesTable.id, collegeId)).limit(1);
  if (college.length === 0) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "College not found" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash, collegeId }).returning();

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  await db.update(usersTable).set({ refreshToken }).where(eq(usersTable.id, user.id));

  res.status(201).json({ accessToken, refreshToken, user: mapUserToProfile(user, college[0]) });
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

  if (!user) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid credentials" });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: "FORBIDDEN", message: "Account has been banned" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid credentials" });
    return;
  }

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = signRefreshToken({ userId: user.id, email: user.email });
  await db.update(usersTable).set({ refreshToken, lastActiveAt: new Date(), isActive: true }).where(eq(usersTable.id, user.id));

  const college = await db.select().from(collegesTable).where(eq(collegesTable.id, user.collegeId)).limit(1);
  res.json({ accessToken, refreshToken, user: mapUserToProfile(user, college[0] ?? null) });
});

router.post("/auth/refresh", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (!refreshToken) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Refresh token required" });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId)).limit(1);

    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid refresh token" });
      return;
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const newRefreshToken = signRefreshToken({ userId: user.id, email: user.email });
    await db.update(usersTable).set({ refreshToken: newRefreshToken }).where(eq(usersTable.id, user.id));

    const college = await db.select().from(collegesTable).where(eq(collegesTable.id, user.collegeId)).limit(1);
    res.json({ accessToken, refreshToken: newRefreshToken, user: mapUserToProfile(user, college[0] ?? null) });
  } catch {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Invalid or expired refresh token" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { verifyAccessToken } = await import("../lib/auth.js");
      const payload = verifyAccessToken(authHeader.slice(7));
      await db.update(usersTable).set({ refreshToken: null, isActive: false }).where(eq(usersTable.id, payload.userId));
    } catch { /* ignore */ }
  }
  res.json({ success: true, message: "Logged out" });
});

export default router;
