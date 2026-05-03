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
- **Auth**: JWT (access + refresh tokens) with bcryptjs

## Artifacts

- **API Server** (`artifacts/api-server`) — Express REST API at `/api`
- **Campus Connect** (`artifacts/campus-connect`) — Expo mobile app at `/`

## Backend Modules

### Authentication (`/api/auth`)
- POST `/api/auth/register` — Register new user (college email + collegeId required)
- POST `/api/auth/login` — Login, returns JWT access + refresh tokens
- POST `/api/auth/refresh` — Refresh access token
- POST `/api/auth/logout` — Logout (clears refresh token)

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

## Database Schema (PostgreSQL / Drizzle ORM)

Tables: `colleges`, `users`, `posts`, `comments`, `likes`, `conversations`, `messages`, `swipes`, `matches`, `reports`, `blocks`, `moderation_logs`, `admins`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed-colleges` — seed Mumbai colleges into DB

## Colleges Pre-seeded

NMIMS, Mithibai, KES Shroff, Thakur, St. Xavier's, Jai Hind, HR College, SIES, Sophia, Wilson College — all Mumbai colleges.

## Matching Algorithm

Hybrid scoring:
- Interest overlap via Jaccard similarity (50% weight)
- Activity recency (20%)
- Profile completeness (20%)
- Randomness (10%)

Same-college filtering, block list exclusion, already-swiped exclusion applied before scoring.
