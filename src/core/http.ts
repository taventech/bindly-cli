import { writeFileSync } from "node:fs";
import { clearToken, loadToken, saveToken, type CliConfig, type StoredToken } from "./config.js";
import { refresh } from "./oauth.js";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Renders an error `detail` value readably. FastAPI validation errors arrive
// as detail: [{loc, msg, type}, ...]; plain strings pass through; anything
// else is JSON-stringified rather than "[object Object]".
function renderDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        if (d && typeof d === "object" && "msg" in d) {
          const item = d as { loc?: unknown; msg?: unknown };
          const loc = Array.isArray(item.loc)
            ? item.loc.filter((p) => p !== "body" && p !== "query" && p !== "path").join(".")
            : "";
          return loc ? `${loc}: ${item.msg}` : String(item.msg);
        }
        return typeof d === "string" ? d : JSON.stringify(d);
      })
      .join("; ");
  }
  if (detail != null && typeof detail === "object") return JSON.stringify(detail);
  return String(detail);
}

// Best readable message for a non-2xx body: JSON `detail`/`error` first, then
// raw text (HTML proxy pages), then a status-code fallback.
function errorDetail(parsed: unknown, status: number, fallback: string): string {
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (obj.detail != null) return renderDetail(obj.detail);
    if (obj.error != null) return renderDetail(obj.error);
  }
  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  return `${fallback} (${status})`;
}

export interface ClientOptions {
  cfg: CliConfig;
  apiBase: string; // e.g. https://api.hedgespecialty.com/api/v1
  // A static credential (Bindly org API key) sent as a header instead of OAuth.
  apiKey?: string;
  apiKeyHeader?: string; // default "X-Api-Key"
}

// Returns a valid bearer, refreshing (and persisting) if within 60s of expiry.
async function bearer(cfg: CliConfig): Promise<string> {
  const tok = loadToken(cfg);
  if (!tok) throw new ApiError(401, "Not signed in. Run `login` first");
  if (tok.expires_at - 60 > Math.floor(Date.now() / 1000)) return tok.access_token;
  if (!tok.refresh_token) throw new ApiError(401, "Session expired. Run `login` again");
  try {
    const r = await refresh(tok.token_endpoint, tok.client_id, tok.refresh_token);
    const updated: StoredToken = {
      ...tok,
      access_token: r.access_token,
      refresh_token: r.refresh_token ?? tok.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + (r.expires_in ?? 3600),
      scope: r.scope ?? tok.scope,
    };
    saveToken(cfg, updated);
    return updated.access_token;
  } catch {
    clearToken(cfg);
    throw new ApiError(401, "Session expired. Run `login` again");
  }
}

export async function apiRequest<T = unknown>(
  opts: ClientOptions,
  method: string,
  path: string,
  init?: { body?: unknown; headers?: Record<string, string>; query?: Record<string, string | undefined> },
): Promise<T> {
  const url = new URL(opts.apiBase.replace(/\/$/, "") + path);
  for (const [k, v] of Object.entries(init?.query ?? {})) if (v != null) url.searchParams.set(k, v);
  const headers: Record<string, string> = { Accept: "application/json", ...(init?.headers ?? {}) };
  if (opts.apiKey) {
    headers[opts.apiKeyHeader ?? "X-Api-Key"] = opts.apiKey;
  } else {
    headers.Authorization = `Bearer ${await bearer(opts.cfg)}`;
  }
  let body: string | undefined;
  if (init?.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  const res = await fetch(url, { method, headers, body });
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, errorDetail(parsed, res.status, "Request failed"));
  }
  return parsed as T;
}

// Multipart upload (fetch sets the boundary; JSON path can't). Same auth as
// apiRequest: bearer (refreshing) or the static api key header.
export async function multipartRequest<T = unknown>(
  opts: ClientOptions,
  method: string,
  path: string,
  form: FormData,
): Promise<T> {
  const url = opts.apiBase.replace(/\/$/, "") + path;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.apiKey) headers[opts.apiKeyHeader ?? "X-Api-Key"] = opts.apiKey;
  else headers.Authorization = `Bearer ${await bearer(opts.cfg)}`;
  const res = await fetch(url, { method, headers, body: form });
  const text = await res.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text; // HTML error pages (502s from a proxy) are not JSON
    }
  }
  if (!res.ok) {
    throw new ApiError(res.status, errorDetail(parsed, res.status, "Upload failed"));
  }
  return parsed as T;
}

// Binary download with the same auth as apiRequest. Writes the response body
// to outPath and returns it. Non-2xx responses throw ApiError with the parsed
// detail (JSON `detail`/`error` or raw text; HTML error pages do not crash).
export async function downloadRequest(
  opts: ClientOptions,
  method: string,
  path: string,
  outPath: string,
): Promise<string> {
  const url = opts.apiBase.replace(/\/$/, "") + path;
  const headers: Record<string, string> = {};
  if (opts.apiKey) headers[opts.apiKeyHeader ?? "X-Api-Key"] = opts.apiKey;
  else headers.Authorization = `Bearer ${await bearer(opts.cfg)}`;
  const res = await fetch(url, { method, headers });
  if (!res.ok) {
    const text = await res.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text; // HTML error pages (502s from a proxy) are not JSON
      }
    }
    throw new ApiError(res.status, errorDetail(parsed, res.status, "Download failed"));
  }
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return outPath;
}
