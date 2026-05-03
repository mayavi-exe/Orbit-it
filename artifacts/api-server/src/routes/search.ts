import { Router } from "express";
import { db, usersTable, collegesTable, postsTable } from "@workspace/db";
import { ilike, or, and, eq, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { mapPublicProfile } from "./users.js";
import { z } from "zod";

const router = Router();

const searchSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/search/users", requireAuth, async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "q is required" });
    return;
  }

  const { q, limit } = parsed.data;
  const pattern = `%${q}%`;

  const users = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.isBanned, false),
        eq(usersTable.isActive, true),
        or(
          ilike(usersTable.name, pattern),
          ilike(usersTable.username, pattern),
        ),
      ),
    )
    .limit(limit);

  const results = await Promise.all(
    users.map(async (u) => {
      const [college] = await db
        .select()
        .from(collegesTable)
        .where(eq(collegesTable.id, u.collegeId))
        .limit(1);
      return mapPublicProfile(u, college ?? null);
    }),
  );

  res.json({ users: results });
});

router.get("/search/posts", requireAuth, async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "q is required" });
    return;
  }

  const { q, limit } = parsed.data;
  const pattern = `%${q}%`;

  const posts = await db
    .select()
    .from(postsTable)
    .where(ilike(postsTable.content, pattern))
    .orderBy(desc(postsTable.likesCount), desc(postsTable.createdAt))
    .limit(limit);

  const formatted = await Promise.all(
    posts.map(async (p) => {
      let author = null;
      if (!p.isAnonymous && p.authorId) {
        const [u] = await db.select().from(usersTable).where(eq(usersTable.id, p.authorId)).limit(1);
        if (u) {
          const [col] = await db.select().from(collegesTable).where(eq(collegesTable.id, u.collegeId)).limit(1);
          author = mapPublicProfile(u, col ?? null);
        }
      }
      return {
        id: p.id,
        authorId: p.isAnonymous ? null : (p.authorId ?? null),
        author: p.isAnonymous ? null : author,
        collegeId: p.collegeId,
        content: p.content ?? null,
        mediaUrls: p.mediaUrls,
        postType: p.postType,
        isAnonymous: p.isAnonymous,
        likesCount: p.likesCount,
        commentsCount: p.commentsCount,
        isLiked: false,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    }),
  );

  res.json({ posts: formatted });
});

export default router;
