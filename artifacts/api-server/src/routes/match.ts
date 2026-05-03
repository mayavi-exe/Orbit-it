import { Router } from "express";
import { db, usersTable, swipesTable, matchesTable, conversationsTable, collegesTable, blocksTable } from "@workspace/db";
import { eq, and, or, not, inArray, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { mapPublicProfile } from "./users.js";
import { z } from "zod";

const router = Router();

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function activityScore(lastActiveAt: Date | null): number {
  if (!lastActiveAt) return 0;
  const hoursSince = (Date.now() - lastActiveAt.getTime()) / (1000 * 3600);
  return Math.max(0, 1 - hoursSince / 168);
}

router.get("/match/recommendations", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query["limit"]) || 10, 50);
  const myId = req.userId!;

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, myId)).limit(1);
  if (!me) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const alreadySwiped = await db.select({ toUserId: swipesTable.toUserId }).from(swipesTable).where(eq(swipesTable.fromUserId, myId));
  const swipedIds = alreadySwiped.map(s => s.toUserId);

  const blocked = await db.select({ blockedUserId: blocksTable.blockedUserId, blockerId: blocksTable.blockerId })
    .from(blocksTable).where(or(eq(blocksTable.blockerId, myId), eq(blocksTable.blockedUserId, myId)));
  const blockedIds = blocked.map(b => b.blockerId === myId ? b.blockedUserId : b.blockerId);

  const excludeIds = [...new Set([myId, ...swipedIds, ...blockedIds])];

  let candidateQuery = db.select().from(usersTable).where(
    and(
      eq(usersTable.collegeId, me.collegeId),
      eq(usersTable.isActive, true),
      eq(usersTable.isBanned, false),
      excludeIds.length > 0
        ? sql`${usersTable.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`
        : undefined,
    )
  ).limit(100);

  const candidates = await candidateQuery;

  const scored = candidates.map(candidate => {
    const interestScore = jaccardSimilarity(me.interests, candidate.interests);
    const activity = activityScore(candidate.lastActiveAt);
    const profileScore = candidate.profileCompleted ? 1 : 0.5;
    const randomness = Math.random() * 0.1;
    const score = (interestScore * 0.5) + (activity * 0.2) + (profileScore * 0.2) + randomness;
    const commonInterests = me.interests.filter(i => candidate.interests.includes(i));
    return { candidate, score, commonInterests };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  const formatted = await Promise.all(top.map(async ({ candidate, score, commonInterests }) => {
    const [col] = await db.select().from(collegesTable).where(eq(collegesTable.id, candidate.collegeId)).limit(1);
    return {
      user: mapPublicProfile(candidate, col ?? null),
      compatibilityScore: Math.round(score * 100) / 100,
      commonInterests,
    };
  }));

  res.json({ recommendations: formatted });
});

router.post("/match/swipe", requireAuth, async (req, res) => {
  const parsed = z.object({
    toUserId: z.string().uuid(),
    action: z.enum(["LIKE", "PASS"]),
  }).safeParse(req.body);

  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message }); return; }

  const { toUserId, action } = parsed.data;
  const fromUserId = req.userId!;

  if (toUserId === fromUserId) {
    res.status(400).json({ error: "BAD_REQUEST", message: "Cannot swipe on yourself" }); return;
  }

  await db.insert(swipesTable).values({ fromUserId, toUserId, action })
    .onConflictDoUpdate({ target: [swipesTable.fromUserId, swipesTable.toUserId], set: { action, createdAt: new Date() } });

  if (action === "PASS") {
    res.json({ matched: false, matchId: null }); return;
  }

  const [mutualLike] = await db.select().from(swipesTable)
    .where(and(eq(swipesTable.fromUserId, toUserId), eq(swipesTable.toUserId, fromUserId), eq(swipesTable.action, "LIKE")))
    .limit(1);

  if (!mutualLike) {
    res.json({ matched: false, matchId: null }); return;
  }

  const [existingMatch] = await db.select().from(matchesTable)
    .where(or(
      and(eq(matchesTable.user1Id, fromUserId), eq(matchesTable.user2Id, toUserId)),
      and(eq(matchesTable.user1Id, toUserId), eq(matchesTable.user2Id, fromUserId)),
    )).limit(1);

  if (existingMatch) {
    res.json({ matched: true, matchId: existingMatch.id }); return;
  }

  const [conv] = await db.insert(conversationsTable).values({ user1Id: fromUserId, user2Id: toUserId }).returning();
  const [match] = await db.insert(matchesTable).values({
    user1Id: fromUserId,
    user2Id: toUserId,
    compatibilityScore: "0.5",
    conversationId: conv.id,
  }).returning();

  res.json({ matched: true, matchId: match.id });
});

router.get("/match", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const matches = await db.select().from(matchesTable)
    .where(and(
      or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)),
      eq(matchesTable.isActive, true),
    ))
    .orderBy(desc(matchesTable.matchedAt));

  const formatted = await Promise.all(matches.map(async m => {
    const otherUserId = m.user1Id === userId ? m.user2Id : m.user1Id;
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, otherUserId)).limit(1);
    const [col] = u ? await db.select().from(collegesTable).where(eq(collegesTable.id, u.collegeId)).limit(1) : [null];
    return {
      id: m.id,
      otherUser: u ? mapPublicProfile(u, col ?? null) : null,
      compatibilityScore: parseFloat(m.compatibilityScore),
      matchedAt: m.matchedAt.toISOString(),
      conversationId: m.conversationId ?? null,
    };
  }));

  res.json({ matches: formatted });
});

router.get("/match/suggestions", requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query["limit"]) || 15, 50);
  const myId = req.userId!;

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, myId)).limit(1);
  if (!me) { res.status(404).json({ error: "NOT_FOUND", message: "User not found" }); return; }

  const alreadySwiped = await db
    .select({ toUserId: swipesTable.toUserId })
    .from(swipesTable)
    .where(eq(swipesTable.fromUserId, myId));
  const swipedIds = alreadySwiped.map(s => s.toUserId);

  const blocked = await db
    .select({ blockedUserId: blocksTable.blockedUserId, blockerId: blocksTable.blockerId })
    .from(blocksTable)
    .where(or(eq(blocksTable.blockerId, myId), eq(blocksTable.blockedUserId, myId)));
  const blockedIds = blocked.map(b => b.blockerId === myId ? b.blockedUserId : b.blockerId);

  const excludeIds = new Set([myId, ...swipedIds, ...blockedIds]);

  const myMatches = await db
    .select({ user1Id: matchesTable.user1Id, user2Id: matchesTable.user2Id })
    .from(matchesTable)
    .where(and(
      or(eq(matchesTable.user1Id, myId), eq(matchesTable.user2Id, myId)),
      eq(matchesTable.isActive, true),
    ));

  const myMatchedUserIds = myMatches.map(m => m.user1Id === myId ? m.user2Id : m.user1Id);

  if (myMatchedUserIds.length === 0) {
    res.json({ suggestions: [] }); return;
  }

  const friendsOfFriendsMatches = await db
    .select({ user1Id: matchesTable.user1Id, user2Id: matchesTable.user2Id })
    .from(matchesTable)
    .where(and(
      or(
        inArray(matchesTable.user1Id, myMatchedUserIds),
        inArray(matchesTable.user2Id, myMatchedUserIds),
      ),
      eq(matchesTable.isActive, true),
    ));

  const mutualCountMap = new Map<string, number>();
  for (const m of friendsOfFriendsMatches) {
    const candidateId = myMatchedUserIds.includes(m.user1Id) ? m.user2Id : m.user1Id;
    if (!excludeIds.has(candidateId)) {
      mutualCountMap.set(candidateId, (mutualCountMap.get(candidateId) ?? 0) + 1);
    }
  }

  const sortedCandidateIds = [...mutualCountMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  if (sortedCandidateIds.length === 0) {
    res.json({ suggestions: [] }); return;
  }

  const candidates = await db
    .select()
    .from(usersTable)
    .where(and(
      inArray(usersTable.id, sortedCandidateIds),
      eq(usersTable.isActive, true),
      eq(usersTable.isBanned, false),
    ));

  const formatted = await Promise.all(
    sortedCandidateIds
      .map(id => candidates.find(c => c.id === id))
      .filter(Boolean)
      .map(async candidate => {
        const [col] = await db.select().from(collegesTable).where(eq(collegesTable.id, candidate!.collegeId)).limit(1);
        const commonInterests = me.interests.filter(i => candidate!.interests.includes(i));
        return {
          user: mapPublicProfile(candidate!, col ?? null),
          mutualCount: mutualCountMap.get(candidate!.id) ?? 0,
          commonInterests,
        };
      })
  );

  res.json({ suggestions: formatted });
});

router.get("/match/stats", requireAuth, async (req, res) => {
  const userId = req.userId!;

  const [totalMatches] = await db.select({ count: sql<number>`count(*)::int` }).from(matchesTable)
    .where(or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)));

  const [pendingLikes] = await db.select({ count: sql<number>`count(*)::int` }).from(swipesTable)
    .where(and(eq(swipesTable.toUserId, userId), eq(swipesTable.action, "LIKE")));

  res.json({
    totalMatches: totalMatches?.count ?? 0,
    pendingLikes: pendingLikes?.count ?? 0,
    profileViews: 0,
  });
});

export default router;
