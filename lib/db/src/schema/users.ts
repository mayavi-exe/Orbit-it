import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { collegesTable } from "./colleges";

export const genderEnum = pgEnum("gender", [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "PREFER_NOT_TO_SAY",
]);
export const verificationStatusEnum = pgEnum("verification_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkId: text("clerk_id").unique(),
    name: text("name").notNull(),
    username: text("username").unique(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash"),
    bio: text("bio"),
    gender: genderEnum("gender"),
    age: integer("age"),
    profilePhotos: text("profile_photos").array().notNull().default([]),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => collegesTable.id),
    interests: text("interests").array().notNull().default([]),
    clubs: text("clubs").array().notNull().default([]),
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    isIdVerified: boolean("is_id_verified").notNull().default(false),
    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("PENDING"),
    isProfilePublic: boolean("is_profile_public").notNull().default(true),
    showAge: boolean("show_age").notNull().default(true),
    showGender: boolean("show_gender").notNull().default(true),
    profileCompleted: boolean("profile_completed").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    isBanned: boolean("is_banned").notNull().default(false),
    refreshToken: text("refresh_token"),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("users_college_id_idx").on(table.collegeId),
    index("users_last_active_at_idx").on(table.lastActiveAt),
    index("users_clerk_id_idx").on(table.clerkId),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
