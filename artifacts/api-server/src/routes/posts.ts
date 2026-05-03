import { Router } from "express";
import { db, postsTable, commentsTable, likesTable, usersTable, collegesTable, blocksTable } from "@workspace/db";
import { eq, and, lt, desc, sql, or, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { z } from "zod";
import { mapPublicProfile } from "./users.js";

const router = Router();

const createPostSchema = z.object({
  content: z.string().optional(),
  mediaUrls: z.array(z.string()).optional(),
  postType: z.enum(["TEXT", "IMAGE", "CONFESSION", "EVENT"]),
  isAnonymous: z.boolean().optional().default(false),
});

async function getBlockedIds(userId: string): Promise<string[]> {
  const blocks = await db.select({ blockedUserId: blocksTable.blockedUserId, blockerId: blocksTable.blockerId })
    .from(blocksTable)
    .where(or(eq(blocksTable.blockerId, userId), eq(blocksTable.blockedUserId, userId)));
  return blocks.map(b => b.blockerId === userId ? b.blockedUserId : b.blockerId);
}

async function formatPost(post: typeof postsTable.$inferSelect, currentUserId: string) {
  let author = null;
  if (!post.isAnonymous && post.authorId) {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, post.authorId)).limit(1);
    if (u) {
      const [col] = await db.select().from(collegesTable).where(eq(collegesTable.id, u.collegeId)).limit(1);
      author = mapPublicProfile(u, col ?? null);
    }
  }

  const [likeRow] = await db.select({ count: sql<number>`1` }).from(likesTable)
    .where(and(eq(likesTable.userId, currentUserId), eq(likesTable.postId, post.id))).limit(1);

  return {
    id: post.id,
    authorId: post.isAnonymous ? null : (post.authorId ?? null),
    author: post.isAnonymous ? null : author,
    collegeId: post.collegeId,
    content: post.content ?? null,
    mediaUrls: post.mediaUrls,
    postType: post.postType,
    isAnonymous: post.isAnonymous,
    likesCount: post.likesCount,
    commentsCount: post.commentsCount,
    isLiked: !!likeRow,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

router.post("/posts", requireAuth, async (req, res) => {
  const parsed = createPostSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message }); return; }

  const [user] = await db.select({ collegeId: usersTable.collegeId }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const { content, mediaUrls = [], postType, isAnonymous = false } = parsed.data;
  if (!content && mediaUrls.length === 0) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Post must have content or media" }); return;
  }

  const [post] = await db.insert(postsTable).values({
    authorId: req.userId!,
    collegeId: user.collegeId,
    content,
    mediaUrls,
    postType,
    isAnonymous,
  }).returning();

  res.status(201).json(await formatPost(post, req.userId!));
});

router.get("/posts/feed", requireAuth, async (req, res) => {
  const [user] = await db.select({ collegeId: usersTable.collegeId }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const limit = Math.min(Number(req.query["limit"]) || 20, 50);
  const cursor = req.query["cursor"] as string | undefined;
  const postType = req.query["postType"] as string | undefined;

  const blockedIds = await getBlockedIds(req.userId!);

  let query = db.select().from(postsTable).where(
    and(
      eq(postsTable.collegeId, user.collegeId),
      cursor ? lt(postsTable.createdAt, new Date(cursor)) : undefined,
      postType ? eq(postsTable.postType, postType as "TEXT" | "IMAGE" | "CONFESSION" | "EVENT") : undefined,
      blockedIds.length > 0 ? sql`${postsTable.authorId} NOT IN (${sql.join(blockedIds.map(id => sql`${id}`), sql`, `)})` : undefined,
    )
  ).orderBy(desc(postsTable.createdAt)).limit(limit + 1);

  const posts = await query;
  const hasMore = posts.length > limit;
  const items = posts.slice(0, limit);
  const formatted = await Promise.all(items.map(p => formatPost(p, req.userId!)));
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  res.json({ posts: formatted, nextCursor });
});

router.get("/posts/trending", requireAuth, async (req, res) => {
  const [user] = await db.select({ collegeId: usersTable.collegeId }).from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!user) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const posts = await db.select().from(postsTable)
    .where(and(eq(postsTable.collegeId, user.collegeId), lt(oneDayAgo, postsTable.createdAt)))
    .orderBy(desc(postsTable.likesCount), desc(postsTable.commentsCount))
    .limit(20);

  const formatted = await Promise.all(posts.map(p => formatPost(p, req.userId!)));
  res.json({ posts: formatted, nextCursor: null });
});

router.get("/posts/:postId", requireAuth, async (req, res) => {
  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, req.params["postId"]!)).limit(1);
  if (!post) { res.status(404).json({ error: "NOT_FOUND", message: "Post not found" }); return; }
  res.json(await formatPost(post, req.userId!));
});

router.post("/posts/:postId/like", requireAuth, async (req, res) => {
  const postId = req.params["postId"]!;
  const userId = req.userId!;

  const [post] = await db.select({ id: postsTable.id, likesCount: postsTable.likesCount }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "NOT_FOUND", message: "Post not found" }); return; }

  const [existing] = await db.select().from(likesTable).where(and(eq(likesTable.userId, userId), eq(likesTable.postId, postId))).limit(1);

  if (existing) {
    await db.delete(likesTable).where(eq(likesTable.id, existing.id));
    const [updated] = await db.update(postsTable).set({ likesCount: Math.max(0, post.likesCount - 1) }).where(eq(postsTable.id, postId)).returning({ likesCount: postsTable.likesCount });
    res.json({ liked: false, likesCount: updated?.likesCount ?? 0 });
  } else {
    await db.insert(likesTable).values({ userId, postId });
    const [updated] = await db.update(postsTable).set({ likesCount: post.likesCount + 1 }).where(eq(postsTable.id, postId)).returning({ likesCount: postsTable.likesCount });
    res.json({ liked: true, likesCount: updated?.likesCount ?? 0 });
  }
});

router.get("/posts/:postId/comments", requireAuth, async (req, res) => {
  const postId = req.params["postId"]!;
  const cursor = req.query["cursor"] as string | undefined;
  const limit = 20;

  const comments = await db.select().from(commentsTable)
    .where(and(
      eq(commentsTable.postId, postId),
      cursor ? lt(commentsTable.createdAt, new Date(cursor)) : undefined,
    ))
    .orderBy(desc(commentsTable.createdAt))
    .limit(limit + 1);

  const hasMore = comments.length > limit;
  const items = comments.slice(0, limit);

  const formatted = await Promise.all(items.map(async c => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, c.authorId)).limit(1);
    const [col] = u ? await db.select().from(collegesTable).where(eq(collegesTable.id, u.collegeId)).limit(1) : [null];
    return {
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      author: u ? mapPublicProfile(u, col ?? null) : null,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
    };
  }));

  res.json({ comments: formatted, nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null });
});

router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  const postId = req.params["postId"]!;
  const { content } = req.body ?? {};

  if (!content?.trim()) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Comment content is required" }); return;
  }

  const [post] = await db.select({ id: postsTable.id, commentsCount: postsTable.commentsCount }).from(postsTable).where(eq(postsTable.id, postId)).limit(1);
  if (!post) { res.status(404).json({ error: "NOT_FOUND", message: "Post not found" }); return; }

  const [comment] = await db.insert(commentsTable).values({ postId, authorId: req.userId!, content }).returning();
  await db.update(postsTable).set({ commentsCount: post.commentsCount + 1 }).where(eq(postsTable.id, postId));

  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  const [col] = u ? await db.select().from(collegesTable).where(eq(collegesTable.id, u.collegeId)).limit(1) : [null];

  res.status(201).json({
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    author: u ? mapPublicProfile(u, col ?? null) : null,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
  });
});

export default router;
