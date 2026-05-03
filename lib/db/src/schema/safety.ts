import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { postsTable } from "./posts";

export const reportReasonEnum = pgEnum("report_reason", [
  "SPAM",
  "ABUSE",
  "HARASSMENT",
  "FAKE_PROFILE",
  "NSFW",
  "OTHER",
]);
export const reportStatusEnum = pgEnum("report_status", [
  "PENDING",
  "REVIEWED",
  "ACTION_TAKEN",
]);
export const adminActionTypeEnum = pgEnum("admin_action_type", [
  "BAN_USER",
  "DELETE_POST",
  "WARN_USER",
  "DISMISS",
]);
export const adminRoleEnum = pgEnum("admin_role", [
  "SUPER_ADMIN",
  "MODERATOR",
]);

export const reportsTable = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    targetUserId: uuid("target_user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    targetPostId: uuid("target_post_id").references(() => postsTable.id, {
      onDelete: "set null",
    }),
    targetMessageId: uuid("target_message_id"),
    reason: reportReasonEnum("reason").notNull(),
    description: text("description"),
    status: reportStatusEnum("status").notNull().default("PENDING"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("reports_status_idx").on(table.status)],
);

export const blocksTable = pgTable(
  "blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blockerId: uuid("blocker_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    blockedUserId: uuid("blocked_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("blocks_unique").on(table.blockerId, table.blockedUserId),
    index("blocks_blocker_idx").on(table.blockerId),
  ],
);

export const moderationLogsTable = pgTable("moderation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => usersTable.id),
  action: adminActionTypeEnum("action").notNull(),
  targetId: uuid("target_id").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const adminsTable = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  role: adminRoleEnum("role").notNull().default("MODERATOR"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type Report = typeof reportsTable.$inferSelect;
export type Block = typeof blocksTable.$inferSelect;
export type Admin = typeof adminsTable.$inferSelect;
