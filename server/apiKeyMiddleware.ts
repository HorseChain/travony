import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { apiKeys } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface ApiKeyPayload {
  keyId: string;
  ownerId: string;
  scopes: string[];
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyPayload;
    }
  }
}

export async function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const keyHeader = req.headers["x-api-key"] as string | undefined;
  if (!keyHeader || !keyHeader.startsWith("tvny_")) {
    return next();
  }

  try {
    const prefix = keyHeader.slice(0, 16);
    const [match] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.keyPrefix, prefix), eq(apiKeys.isActive, true)))
      .limit(1);

    if (!match) {
      return res.status(401).json({ error: "Invalid API key", code: "INVALID_API_KEY" });
    }

    const { createHash } = await import("crypto");
    const hash = createHash("sha256").update(keyHeader).digest("hex");
    if (hash !== match.keyHash) {
      return res.status(401).json({ error: "Invalid API key", code: "INVALID_API_KEY" });
    }

    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, match.id));

    req.apiKey = {
      keyId: match.id,
      ownerId: match.ownerId,
      scopes: match.scopes as string[],
    };

    next();
  } catch (err) {
    console.error("API key middleware error:", err);
    next();
  }
}

export function requireScope(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.apiKey && req.apiKey.scopes.includes(scope)) {
      return next();
    }
    if ((req as any).session || (req as any).userId) {
      return next();
    }
    res.status(403).json({
      error: "Forbidden",
      code: "INSUFFICIENT_SCOPE",
      message: `This endpoint requires the '${scope}' scope on your API key`,
    });
  };
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const secret = randomBytes(24).toString("hex");
  const key = `tvny_live_${secret}`;
  const prefix = key.slice(0, 16);
  const { createHash } = require("crypto");
  const hash = createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}
