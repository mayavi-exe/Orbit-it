import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;

  if (!clerkUserId) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required" });
    return;
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id, email: usersTable.email, isBanned: usersTable.isBanned })
      .from(usersTable)
      .where(eq(usersTable.clerkId, clerkUserId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "ONBOARDING_REQUIRED", message: "Please complete your profile setup" });
      return;
    }

    if (user.isBanned) {
      res.status(403).json({ error: "FORBIDDEN", message: "Account suspended" });
      return;
    }

    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch (err) {
    next(err);
  }
}
