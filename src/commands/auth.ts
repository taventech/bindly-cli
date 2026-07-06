import type { Command } from "commander";
import { loginInteractive, clearToken, saveToken } from "../core/index.js";
import { makeCtx, resolveEnv } from "../context.js";

export function registerAuth(program: Command): void {
  program
    .command("login")
    .description("Sign in to Bindly (device code by default, or paste a workspace API key)")
    .option("--api-key <key>", "use a workspace API key (bk_live_… / bsk_…) instead of interactive login")
    .option("--browser", "use the browser (loopback) flow instead of a device code")
    .action(async (opts) => {
      const ctx = makeCtx(program.opts());
      if (opts.apiKey) {
        saveToken(ctx.cfg, {
          access_token: "",
          expires_at: 0,
          token_endpoint: "",
          client_id: "",
          api_key: String(opts.apiKey),
        });
        process.stdout.write("Saved workspace API key.\n");
        return;
      }
      await loginInteractive({
        cfg: ctx.cfg,
        metadataUrl: ctx.env.metadataUrl,
        clientName: "Bindly CLI",
        scope: "bindly",
        mode: opts.browser ? "browser" : "device",
        log: (m) => process.stdout.write(m + "\n"),
      });
      process.stdout.write("\nSigned in.\n");
    });

  program
    .command("logout")
    .description("Remove stored credentials")
    .action(() => {
      const ctx = makeCtx(program.opts());
      clearToken(ctx.cfg);
      process.stdout.write("Signed out.\n");
    });
}
