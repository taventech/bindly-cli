import { loadToken, type CliConfig, type ClientOptions } from "./core/index.js";

export interface Env {
  metadataUrl: string;
  apiBase: string;
  appBase: string;
}

export function resolveEnv(): Env {
  const engine = process.env.BINDLY_ENGINE_URL || "https://engine.bindly.insure";
  return {
    metadataUrl: `${engine}/oauth/.well-known/oauth-authorization-server`,
    apiBase: engine,
    appBase: process.env.BINDLY_APP_URL || "https://app.bindly.insure",
  };
}

export interface Ctx {
  env: Env;
  cfg: CliConfig;
  client: ClientOptions;
  json: boolean;
}

// Auth resolves to EITHER a stored org API key (login --api-key) or the
// device/browser OAuth token, whichever is present. The engine /org routes
// accept both.
export function makeCtx(opts: { json?: boolean }): Ctx {
  const env = resolveEnv();
  const cfg: CliConfig = { appName: "bindly", profile: "prod" };
  const stored = loadToken(cfg);
  const apiKey = stored?.api_key || undefined;
  return {
    env,
    cfg,
    client: apiKey
      ? { cfg, apiBase: env.apiBase, apiKey, apiKeyHeader: "X-Api-Key" }
      : { cfg, apiBase: env.apiBase },
    json: !!opts.json,
  };
}
