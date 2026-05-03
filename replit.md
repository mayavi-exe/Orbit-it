# Campus Connect

## Overview

A college-based community and dating app for Mumbai college students. Full-stack monorepo with a production-grade Express backend and Expo React Native mobile app.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) with expo-router
- **Auth**: Clerk (email/password + Google + LinkedIn OAuth) via `@clerk/expo` + `@clerk/express`

## Artifacts

- **API Server** (`artifacts/api-server`) — Express REST API at `/api`
- **Campus Connect** (`artifacts/campus-connect`) — Expo mobile app at `/`

## Authentication Flow (Clerk)

1. User signs up/signs in via Clerk (email+password, Google OAuth, or LinkedIn OAuth)
2. After Clerk auth, the app calls `POST /api/auth/provision` with `{ name, email, collegeId, username? }` to create/get the DB user linked by `clerkId`
3. New users who haven't provisioned yet see the **Onboarding** screen (college picker + username)
4. All API requests send Clerk JWT as `Authorization: Bearer <token>`
5. `requireAuth` middleware: extracts `auth.userId` (Clerk ID) from `getAuth(req)`, looks up DB user by `clerkId`, sets `req.userId`
6. Returns `{ error: "ONBOARDING_REQUIRED" }` (401) if Clerk session exists but no DB user found

### Clerk Env Vars

- `CLERK_PUBLISHABLE_KEY` — set via Auth pane (managed by Replit)
- `CLERK_SECRET_KEY` — set via Auth pane (managed by Replit)
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — injected into Expo dev script from `$CLERK_PUBLISHABLE_KEY`

## Backend Modules

### Authentication (`/api/auth`)
- POST `/api/auth/provision` — Idempotent: create or retrieve DB user after Clerk sign-up (requires Clerk JWT, body: `{ name, email, collegeId, username? }`)

### Users (`/api/users`)
- GET `/api/users/me` — Get my full profile
- PATCH `/api/users/me/profile` — Update profile (bio, interests, photos, etc.)
- GET `/api/users/stats` — My stats (posts, matches, likes received)
- GET `/api/users/:userId` — Get public profile (privacy filtered)
- GET `/api/colleges` — List all supported colleges

### Feed (`/api/posts`)
- POST `/api/posts` — Create post (TEXT/IMAGE/CONFESSION/EVENT)
- GET `/api/posts/feed` — Cursor-paginated feed for user's college
- GET `/api/posts/trending` — Trending posts (24h, by likes+comments)
- GET `/api/posts/:postId` — Get single post
- POST `/api/posts/:postId/like` — Toggle like
- GET `/api/posts/:postId/comments` — Get comments (paginated)
- POST `/api/posts/:postId/comments` — Add comment

### Chat (`/api/chat`)
- GET `/api/chat/conversations` — All conversations sorted by lastMessageAt
- POST `/api/chat/start` — Start or get conversation with a user
- GET `/api/chat/:conversationId/messages` — Load messages (cursor-paginated)
- POST `/api/chat/:conversationId/messages` — Send message

### Matching (`/api/match`)
- GET `/api/match/recommendations` — AI-scored recommendations (Jaccard similarity on interests)
- POST `/api/match/swipe` — Swipe LIKE or PASS; creates match + conversation on mutual like
- GET `/api/match` — All matches
- GET `/api/match/stats` — Match stats (total, pending likes)

### Safety (`/api/report`, `/api/block`, `/api/admin`)
- POST `/api/report` — Submit report (user/post/message)
- POST `/api/block` — Block a user
- DELETE `/api/block/:userId` — Unblock
- GET `/api/block/list` — Get blocked users
- GET `/api/admin/reports` — Admin: list reports
- POST `/api/admin/action` — Admin: take moderation action (BAN/DELETE/WARN/DISMISS)
- GET `/api/admin/users` — Admin: list users with flags

### Search (`/api/search`)
- GET `/api/search/users?q=&limit=` — Search users by name or username (ILIKE, auth required)
- GET `/api/search/posts?q=&limit=` — Search posts by content (ILIKE, sorted by likes, auth required)

## Database Schema (PostgreSQL / Drizzle ORM)

Tables: `colleges`, `users`, `posts`, `comments`, `likes`, `conversations`, `messages`, `swipes`, `matches`, `reports`, `blocks`, `moderation_logs`, `admins`

Key `users` columns:
- `clerk_id TEXT UNIQUE` — links Clerk identity to DB user (nullable for legacy rows)
- `password_hash TEXT` — nullable (OAuth users have no password)
- `username TEXT UNIQUE` — immutable once set, auto-generated from name

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-colleges` — seed Mumbai colleges into DB

## Usernames

- **Auto-generated on registration** from the user's name: `firstname.lastname` → e.g. `rahul.sharma`. Collisions resolved by appending a random 4-digit suffix.
- **Immutable once set** — removed from `updateProfileSchema` so PATCH `/api/users/me/profile` cannot change it.
- **Set during onboarding** — the provision endpoint accepts an optional `username`; if omitted, auto-generated.
- **Format**: lowercase alphanumeric, dots, underscores only. Max 30 chars.
- **Displayed** with `@` prefix throughout the app (profile header, discover cards, chat list, search results).

## Mobile App Screens

- **Sign In** (`/(auth)/sign-in`) — Email+password + Google/LinkedIn OAuth; link to Sign Up
- **Sign Up** (`/(auth)/sign-up`) — Email+password with email verification + Google/LinkedIn OAuth; link to Sign In
- **Onboarding** (`/(auth)/onboarding`) — Profile setup after Clerk auth: name, @username, college picker → calls `/api/auth/provision`
- **Feed (Home tab)** — College feed with like/comment, Create Post modal
- **Discover tab** — Swipe cards + List mode for recommendations; top search bar switches to Search mode with People/Posts sub-tabs
- **Chat tab** — Conversations list with `@username` display; top search bar finds users by name/username
- **Profile tab** — Avatar, full name, `@username` badge, email, college, stats, bio + interests editing, Sign Out

## Auth Context Shim

`context/AuthContext.tsx` provides a `useAuth()` hook backed by Clerk (`useClerkAuth`) + `useGetMe()` React Query hook. This maintains backward compatibility for screens that import from `@/context/AuthContext`. The shim exposes `{ user, isLoading, logout, updateUser }`.

## Colleges Pre-seeded

NMIMS, Mithibai, KES Shroff, Thakur, St. Xavier's, Jai Hind, HR College, SIES, Sophia, Wilson College — all Mumbai colleges.

## Matching Algorithm

Hybrid scoring:
- Interest overlap via Jaccard similarity (50% weight)
- Activity recency (20%)
- Profile completeness (20%)
- Randomness (10%)

Same-college filtering, block list exclusion, already-swiped exclusion applied before scoring.
