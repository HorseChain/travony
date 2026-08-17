import type { Express, Request, Response, NextFunction } from "express";
import { requirePartner } from "./partnerApi";
import { scopesSatisfy } from "./partnerApi";
import { apiKeyMiddleware } from "./apiKeyMiddleware";
import { AGENT_TOOLS, callAgentTool, toolScope, ToolError } from "./agentGateway";

/**
 * Minimal MCP (Model Context Protocol) server over streamable HTTP.
 *
 * POST /mcp — JSON-RPC 2.0. Supported methods: initialize, ping, tools/list,
 * tools/call (plus notifications, which are acknowledged with 202). Responses
 * are plain JSON (the spec allows JSON responses without an SSE stream).
 *
 * Auth: the same partner API key as the REST gateway, via the X-API-Key
 * header — or `Authorization: Bearer tvny_...` for MCP clients that only
 * support bearer auth. Rate limits, quotas and metering apply per key
 * exactly like every other partner call.
 */

const PROTOCOL_VERSION = "2025-03-26";

function rpcError(id: any, code: number, message: string, data?: any) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

function rpcResult(id: any, result: any) {
  return { jsonrpc: "2.0", id, result };
}

/**
 * Let bearer-only MCP clients authenticate: copy a tvny_ bearer into
 * X-API-Key and re-run the key middleware — the global pass already happened
 * (without the header) by the time this route-level middleware runs.
 */
function bearerShim(req: Request, res: Response, next: NextFunction) {
  if (!req.apiKey && !req.headers["x-api-key"]) {
    const auth = String(req.headers.authorization || "");
    if (auth.startsWith("Bearer tvny_")) {
      req.headers["x-api-key"] = auth.slice(7);
      return apiKeyMiddleware(req, res, next);
    }
  }
  next();
}

async function handleRpc(req: Request, message: any): Promise<any | null> {
  const { id, method, params } = message || {};
  if (typeof method !== "string") return rpcError(id, -32600, "Invalid request");

  // Notifications (no id) are acknowledged without a body.
  if (id === undefined || id === null) return null;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: typeof params?.protocolVersion === "string" ? params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "travony-agent-gateway", version: "1.0.0" },
        instructions:
          "Travony ride-hailing tools: quote and book real rides. book_ride is idempotent — always pass a fresh idempotencyKey per new booking and reuse it on retries. All fares are computed server-side. Identify your platform via the X-Agent-Id header.",
      });

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, {
        tools: AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });

    case "tools/call": {
      const name = String(params?.name || "");
      const scope = toolScope(name);
      if (!scope) return rpcError(id, -32602, `Unknown tool '${name}'`);
      const key = req.apiKey!;
      if (!scopesSatisfy(key.scopes, scope)) {
        return rpcResult(id, {
          isError: true,
          content: [{ type: "text", text: `This tool requires the '${scope}' scope on your API key.` }],
        });
      }
      const agentId = String(req.headers["x-agent-id"] || params?._meta?.agentId || "mcp-client").slice(0, 120);
      try {
        const out = await callAgentTool(
          { keyId: key.keyId, ownerId: key.ownerId, planTier: key.planTier },
          agentId,
          name,
          params?.arguments,
        );
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(out, null, 2) }],
          structuredContent: out,
        });
      } catch (err: any) {
        const msg = err instanceof ToolError ? `${err.code}: ${err.message}` : "Internal error — retry book_ride with the same idempotencyKey.";
        if (!(err instanceof ToolError)) console.error("[MCP] tool error:", err);
        return rpcResult(id, { isError: true, content: [{ type: "text", text: msg }] });
      }
    }

    default:
      return rpcError(id, -32601, `Method '${method}' not supported`);
  }
}

export function setupMcpServer(app: Express) {
  app.post("/mcp", bearerShim, requirePartner(null), async (req: Request, res: Response) => {
    try {
      const body = req.body;
      if (Array.isArray(body)) {
        const responses = (await Promise.all(body.map((m) => handleRpc(req, m)))).filter((r) => r !== null);
        if (!responses.length) return res.status(202).end();
        return res.json(responses);
      }
      const response = await handleRpc(req, body);
      if (response === null) return res.status(202).end();
      res.json(response);
    } catch (err) {
      console.error("[MCP] request error:", err);
      res.status(500).json(rpcError(null, -32603, "Internal error"));
    }
  });

  // GET /mcp: some clients probe it; we don't maintain a server-push stream.
  app.get("/mcp", (_req, res) => res.status(405).json({ message: "POST JSON-RPC messages to this endpoint (MCP streamable HTTP)." }));

  console.log("MCP server: POST /mcp (tools: " + AGENT_TOOLS.map((t) => t.name).join(", ") + ")");
}
