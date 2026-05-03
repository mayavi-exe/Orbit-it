import { Router } from "express";
import { db, reportsTable, blocksTable, usersTable, postsTable, moderationLogsTable, adminsTable, collegesTable } from "@workspace/db";
import { eq, and, or, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/requireAuth.js";
import { mapPublicProfile } from "./users.js";
import { z } from "zod";

const router = Router();

const reportSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  targetPostId: z.string().uuid().optional(),
  targetMessageId: z.string().uuid().optional(),
  reason: z.enum(["SPAM", "ABUSE", "HARASSMENT", "FAKE_PROFILE", "NSFW", "OTHER"]),
  description: z.string().max(500).optional(),
});

router.post("/report", requireAuth, async (req, res) => {
  const parsed = reportSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message }); return; }

  const { targetUserId, targetPostId, targetMessageId, reason, description } = parsed.data;
  if (!targetUserId && !targetPostId && !targetMessageId) {
    res.status(400).json({ error: "VALIDATION_ERROR", message: "Must specify a target" }); return;
  }

  await db.insert(reportsTable).values({
    reporterId: req.userId!,
    targetUserId,
    targetPostId,
    targetMessageId,
    reason,
    description,
    status: "PENDING",
  });

  res.status(201).json({ success: true, message: "Report submitted successfully" });
});

router.post("/block", requireAuth, async (req, res) => {
  const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", message: "userId required" }); return; }

  const { userId } = parsed.data;
  if (userId === req.userId!) { res.status(400).json({ error: "BAD_REQUEST", message: "Cannot block yourself" }); return; }

  await db.insert(blocksTable).values({ blockerId: req.userId!, blockedUserId: userId })
    .onConflictDoNothing();

  res.json({ success: true, message: "User blocked" });
});

router.delete("/block/:userId", requireAuth, async (req, res) => {
  await db.delete(blocksTable)
    .where(and(eq(blocksTable.blockerId, req.userId!), eq(blocksTable.blockedUserId, req.params["userId"] as string)));
  res.json({ success: true, message: "User unblocked" });
});

router.get("/block/list", requireAuth, async (req, res) => {
  const blocks = await db.select({ blockedUserId: blocksTable.blockedUserId })
    .from(blocksTable).where(eq(blocksTable.blockerId, req.userId!));

  const users = await Promise.all(blocks.map(async b => {
    const [u] = await db.select().from(usersTable).where(eq(usersTable.id, b.blockedUserId)).limit(1);
    const [col] = u ? await db.select().from(collegesTable).where(eq(collegesTable.id, u.collegeId)).limit(1) : [null];
    return u ? mapPublicProfile(u, col ?? null) : null;
  }));

  res.json({ blocked: users.filter(Boolean) });
});

async function requireAdmin(userId: string): Promise<boolean> {
  const [admin] = await db.select().from(adminsTable).where(eq(adminsTable.userId, userId)).limit(1);
  return !!admin;
}

router.get("/admin/reports", requireAuth, async (req, res) => {
  if (!await requireAdmin(req.userId!)) { res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" }); return; }

  const status = req.query["status"] as string | undefined;
  const reports = await db.select().from(reportsTable)
    .where(status ? eq(reportsTable.status, status as "PENDING" | "REVIEWED" | "ACTION_TAKEN") : undefined)
    .orderBy(desc(reportsTable.createdAt))
    .limit(100);

  const formatted = reports.map(r => ({
    id: r.id,
    reporterId: r.reporterId,
    targetUserId: r.targetUserId ?? null,
    targetPostId: r.targetPostId ?? null,
    reason: r.reason,
    description: r.description ?? null,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  res.json({ reports: formatted });
});

router.post("/admin/action", requireAuth, async (req, res) => {
  if (!await requireAdmin(req.userId!)) { res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" }); return; }

  const parsed = z.object({
    reportId: z.string().uuid(),
    actionType: z.enum(["BAN_USER", "DELETE_POST", "WARN_USER", "DISMISS"]),
    notes: z.string().optional(),
  }).safeParse(req.body);

  if (!parsed.success) { res.status(400).json({ error: "VALIDATION_ERROR", message: parsed.error.message }); return; }

  const { reportId, actionType, notes } = parsed.data;
  const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, reportId)).limit(1);
  if (!report) { res.status(404).json({ error: "NOT_FOUND", message: "Report not found" }); return; }

  if (actionType === "BAN_USER" && report.targetUserId) {
    await db.update(usersTable).set({ isBanned: true, isActive: false }).where(eq(usersTable.id, report.targetUserId));
  } else if (actionType === "DELETE_POST" && report.targetPostId) {
    await db.delete(postsTable).where(eq(postsTable.id, report.targetPostId));
  }

  await db.update(reportsTable).set({ status: "ACTION_TAKEN", reviewedAt: new Date() }).where(eq(reportsTable.id, reportId));
  await db.insert(moderationLogsTable).values({
    adminId: req.userId!,
    action: actionType,
    targetId: report.targetUserId ?? report.targetPostId ?? reportId,
    reason: notes,
  });

  res.json({ success: true, message: "Action taken" });
});

router.get("/admin/users", requireAuth, async (req, res) => {
  if (!await requireAdmin(req.userId!)) { res.status(403).json({ error: "FORBIDDEN", message: "Admin access required" }); return; }

  const users = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt)).limit(100);
  const colleges = await db.select().from(collegesTable);
  const collegeMap = new Map(colleges.map(c => [c.id, c]));

  const formatted = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    collegeId: u.collegeId,
    college: collegeMap.get(u.collegeId) ? {
      id: collegeMap.get(u.collegeId)!.id,
      name: collegeMap.get(u.collegeId)!.name,
      domain: collegeMap.get(u.collegeId)!.domain,
      location: collegeMap.get(u.collegeId)!.location,
    } : null,
    isActive: u.isActive,
    isBanned: u.isBanned,
    reportCount: 0,
    createdAt: u.createdAt.toISOString(),
  }));

  res.json({ users: formatted });
});

export default router;
