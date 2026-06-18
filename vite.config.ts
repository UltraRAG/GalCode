import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import type { Connect, Plugin, PreviewServer, ViteDevServer } from "vite";

function normalizeChatApiUrl(apiUrl: string) {
  const raw = String(apiUrl || "").trim();
  if (!raw) return "";
  const trimmed = raw.replace(/\/+$/, "");
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function extractChatText(payload: any) {
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content ?? choice?.delta?.content ?? choice?.text;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part.text || part.content || ""))
      .filter(Boolean)
      .join("");
  }
  return payload?.output_text || payload?.text || "";
}

async function readJsonBody(req: Connect.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res: Connect.ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function installGalCodeApiProxy(server: ViteDevServer | PreviewServer) {
  server.middlewares.use("/api/galcode/chat", async (req, res) => {
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== "POST") {
      sendJson(res, 405, { ok: false, error: "Method not allowed." });
      return;
    }

    try {
      const body = await readJsonBody(req);
      const apiUrl = normalizeChatApiUrl(body.apiUrl);
      if (!apiUrl) {
        sendJson(res, 400, { ok: false, error: "API URL is required." });
        return;
      }
      if (!body.model) {
        sendJson(res, 400, { ok: false, error: "Model is required." });
        return;
      }

      const headers: Record<string, string> = {
        "content-type": "application/json"
      };
      if (body.apiKey) headers.authorization = `Bearer ${body.apiKey}`;

      const upstream = await fetch(apiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: body.model,
          messages: body.messages || [],
          temperature: Number.isFinite(body.temperature) ? body.temperature : 0.8,
          stream: false
        })
      });
      const raw = await upstream.text();
      if (!upstream.ok) {
        sendJson(res, upstream.status, { ok: false, error: raw.trim() || `HTTP ${upstream.status}` });
        return;
      }

      const parsed = raw ? JSON.parse(raw) : {};
      const text = extractChatText(parsed).trim();
      if (!text) {
        sendJson(res, 502, { ok: false, error: "Chat API returned an empty response." });
        return;
      }
      sendJson(res, 200, { ok: true, text });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Chat proxy request failed."
      });
    }
  });
}

function galCodeApiProxy(): Plugin {
  return {
    name: "galcode-api-proxy",
    configureServer(server) {
      installGalCodeApiProxy(server);
    },
    configurePreviewServer(server) {
      installGalCodeApiProxy(server);
    }
  };
}

export default defineConfig({
  base: "./",
  publicDir: "sample-assets",
  plugins: [react(), galCodeApiProxy()],
  server: {
    port: 5173,
    strictPort: true
  }
});
