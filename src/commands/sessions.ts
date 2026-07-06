import type { Command } from "commander";
import { apiRequest, table, kv, printJson } from "../core/index.js";
import { makeCtx } from "../context.js";

export function registerSessions(program: Command): void {
  const session = program.command("session").description("Manage Bindly intake sessions");

  session
    .command("new")
    .description("Start an intake session for an insured")
    .requiredOption("--insured <name>", "insured business name")
    .option("--state <ST>", "2-letter state")
    .option("--lob <slugs>", "comma-separated lines of business")
    .option("--naics <code>", "NAICS code")
    .action(async (opts) => {
      const ctx = makeCtx(program.opts());
      const body: Record<string, unknown> = { insured_name: opts.insured };
      if (opts.state) body.state = opts.state;
      if (opts.naics) body.naics_code = opts.naics;
      if (opts.lob) body.lobs = String(opts.lob).split(",").map((s: string) => s.trim());
      const r = await apiRequest<Record<string, any>>(ctx.client, "POST", "/org/sessions", { body });
      if (ctx.json) return printJson(r);
      process.stdout.write(kv({ session_id: r.session_id, insured: r.insured_name, state: r.state, status: r.status, forms: (r.form_keys || []).join(", "), fields: `${r.fields_filled}/${r.fields_total}` }) + "\n");
      process.stdout.write("\nContinue the intake in Bindly, then: bindly session submit " + r.session_id + "\n");
    });

  session
    .command("list")
    .description("List your workspace's sessions")
    .action(async () => {
      const ctx = makeCtx(program.opts());
      const res = await apiRequest<{ sessions?: Record<string, any>[] } | Record<string, any>[]>(ctx.client, "GET", "/org/sessions");
      const rows = Array.isArray(res) ? res : res.sessions ?? [];
      if (ctx.json) return printJson(res);
      process.stdout.write(table(rows.map((r) => ({ id: r.session_id ?? r.id, insured: r.insured_name, status: r.status, progress: `${r.fields_filled ?? 0}/${r.fields_total ?? 0}` })), ["id", "insured", "status", "progress"]) + "\n");
    });

  session
    .command("get <sessionId>")
    .description("Session detail + intake progress")
    .action(async (sessionId) => {
      const ctx = makeCtx(program.opts());
      const r = await apiRequest<Record<string, any>>(ctx.client, "GET", `/org/sessions/${sessionId}`);
      if (ctx.json) return printJson(r);
      process.stdout.write(kv({ insured: r.insured_name, status: r.status, forms: (r.form_keys || []).join(", ") }) + "\n");
    });

  session
    .command("submit <sessionId>")
    .description("Submit a completed session to Hedge (via your connected Hedge account)")
    .action(async (sessionId) => {
      const ctx = makeCtx(program.opts());
      const r = await apiRequest<Record<string, any>>(ctx.client, "POST", `/org/sessions/${sessionId}/submit`);
      if (ctx.json) return printJson(r);
      process.stdout.write(kv({ hedge_submission_id: r.hedge_submission_id, finalized: r.finalized }) + "\n");
    });
}
