import type { Command } from "commander";
import { readFileSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { apiRequest, multipartRequest, downloadRequest, ApiError, table, kv, printJson } from "../core/index.js";
import { makeCtx } from "../context.js";

const EXTRACT_MAX_BYTES = 20 * 1024 * 1024; // engine caps extract uploads at 20MB

function pdfForm(pdfPath: string, maxBytes?: number): FormData {
  const bytes = readFileSync(pdfPath);
  if (maxBytes && bytes.length > maxBytes) {
    throw new Error(`${basename(pdfPath)} is larger than 20MB (the extract limit). Compress or split it first.`);
  }
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), basename(pdfPath));
  return form;
}

// One ask can arrive as a plain string or as {key, question, group}.
function askText(ask: unknown): string {
  if (typeof ask === "string") return ask;
  if (ask && typeof ask === "object") {
    const a = ask as Record<string, unknown>;
    return String(a.question ?? a.key ?? JSON.stringify(ask));
  }
  return String(ask);
}

function truncate(s: unknown, max = 80): string {
  const str = String(s ?? "");
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
}

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
      let r: Record<string, any>;
      try {
        r = await apiRequest<Record<string, any>>(ctx.client, "POST", "/org/sessions", { body });
      } catch (err) {
        if (err instanceof ApiError && err.status === 402) {
          process.stderr.write(err.message + "\nUpgrade in the Bindly app under Billing.\n");
          process.exit(1);
        }
        throw err;
      }
      if (ctx.json) return printJson(r);
      process.stdout.write(kv({ session_id: r.session_id, insured: r.insured_name, state: r.state, status: r.status, forms: (r.form_keys || []).join(", "), fields: `${r.fields_filled}/${r.fields_total}` }) + "\n");
      process.stdout.write("\nNext: bindly session answer " + r.session_id + " --message \"...\" (or continue in Bindly), then fill, download, submit.\n");
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
      const info: Record<string, unknown> = {
        insured: r.insured_name,
        status: r.status,
        forms: (r.form_keys || []).join(", "),
        progress: `${r.fields_filled ?? 0}/${r.fields_total ?? 0}`,
      };
      if (r.pending_count != null) info.pending = r.pending_count;
      process.stdout.write(kv(info) + "\n");
      const next: Record<string, any>[] = r.next_questions ?? [];
      if (next.length) {
        process.stdout.write("\nNext questions:\n" + next.map((q) => `  - ${q.key ?? askText(q)}`).join("\n") + "\n");
      }
      const filled: Record<string, any>[] = r.filled_forms ?? [];
      if (filled.length) {
        process.stdout.write("\nFilled forms: " + filled.map((f) => f.form_key).join(", ") + "\n");
      }
    });

  session
    .command("answer <sessionId>")
    .description("Answer intake questions conversationally (send a message, get the next asks)")
    .requiredOption("--message <text>", "your answer or free-form details for the intake")
    .action(async (sessionId, opts) => {
      const ctx = makeCtx(program.opts());
      const r = await apiRequest<Record<string, any>>(ctx.client, "POST", `/org/sessions/${sessionId}/answers`, {
        body: { message: opts.message },
      });
      if (ctx.json) return printJson(r);
      if (r.message) process.stdout.write(r.message + "\n");
      process.stdout.write(`\nAnswered ${r.answered_count ?? 0} of ${r.total_askable ?? 0} questions; ${r.pending_count ?? 0} pending.\n`);
      const asks: unknown[] = r.asks ?? [];
      if (asks.length) {
        process.stdout.write("\nNext asks:\n" + asks.slice(0, 5).map((a) => `  - ${askText(a)}`).join("\n") + "\n");
      }
      if (r.done) {
        process.stdout.write("\nIntake complete. Next: bindly session fill " + sessionId + "\n");
      }
    });

  session
    .command("extract <sessionId> <pdf>")
    .description("Extract intake answers from a PDF (ACORD, dec page, supplement)")
    .action(async (sessionId, pdf) => {
      const ctx = makeCtx(program.opts());
      const r = await multipartRequest<Record<string, any>>(ctx.client, "POST", `/org/sessions/${sessionId}/extract`, pdfForm(pdf, EXTRACT_MAX_BYTES));
      if (ctx.json) return printJson(r);
      process.stdout.write(kv({ extracted_fields: r.extracted_count ?? 0 }) + "\n");
      if (r.notes) process.stdout.write("\n" + r.notes + "\n");
    });

  session
    .command("fill <sessionId>")
    .description("Fill the session's ACORD forms from the collected answers")
    .action(async (sessionId) => {
      const ctx = makeCtx(program.opts());
      const r = await apiRequest<Record<string, any>>(ctx.client, "POST", `/org/sessions/${sessionId}/fill`);
      if (ctx.json) return printJson(r);
      const forms: Record<string, any>[] = r.forms ?? [];
      process.stdout.write(table(forms.map((f) => ({
        form: f.form_key,
        fields_written: f.fields_written ?? "",
        warnings: Array.isArray(f.warnings) ? f.warnings.length : f.warnings ?? 0,
      })), ["form", "fields_written", "warnings"]) + "\n");
      const sparse = forms.filter((f) => f.sparse_suspected).map((f) => f.form_key);
      if (sparse.length) {
        process.stdout.write("\nSparse fill suspected: " + sparse.join(", ") + ". Review these PDFs before sending.\n");
      }
      if (r.note) process.stdout.write("\n" + r.note + "\n");
    });

  session
    .command("download <sessionId> [formKey]")
    .description("Download filled form PDFs (one form, or every filled form)")
    .option("-o, --out <dir>", "directory to write PDFs into", ".")
    .action(async (sessionId, formKey, opts) => {
      const ctx = makeCtx(program.opts());
      mkdirSync(opts.out, { recursive: true });
      let keys: string[];
      if (formKey) {
        keys = [formKey];
      } else {
        const detail = await apiRequest<Record<string, any>>(ctx.client, "GET", `/org/sessions/${sessionId}`);
        const filled: Record<string, any>[] = detail.filled_forms ?? [];
        if (!filled.length) {
          throw new Error(`No filled forms on this session yet. Run: bindly session fill ${sessionId}`);
        }
        keys = filled.map((f) => f.form_key);
      }
      const written: string[] = [];
      for (const key of keys) {
        const out = join(opts.out, `${key}.pdf`);
        try {
          written.push(await downloadRequest(ctx.client, "GET", `/org/sessions/${sessionId}/forms/${key}/pdf`, out));
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) {
            throw new ApiError(404, `${err.message} (if ${key} has not been filled yet, run: bindly session fill ${sessionId})`);
          }
          throw err;
        }
      }
      if (ctx.json) return printJson({ written });
      for (const path of written) process.stdout.write("Wrote " + path + "\n");
    });

  session
    .command("risk <sessionId>")
    .description("Underwriting risk flags Bindly spotted in the intake")
    .action(async (sessionId) => {
      const ctx = makeCtx(program.opts());
      const r = await apiRequest<Record<string, any>>(ctx.client, "GET", `/org/sessions/${sessionId}/risk-summary`);
      if (ctx.json) return printJson(r);
      const flags: Record<string, any>[] = r.flags ?? [];
      if (!flags.length) return void process.stdout.write("No risk flags.\n");
      process.stdout.write(table(flags.map((f) => ({
        severity: f.severity,
        title: f.title,
        detail: truncate(f.detail),
      })), ["severity", "title", "detail"]) + "\n");
      process.stdout.write("\nFull detail: add --json\n");
    });

  session
    .command("upload <sessionId> <pdf>")
    .description("Attach a supporting document (loss runs, prior policy) to a session")
    .action(async (sessionId, pdf) => {
      const ctx = makeCtx(program.opts());
      const r = await multipartRequest<Record<string, any>>(ctx.client, "POST", `/org/sessions/${sessionId}/documents`, pdfForm(pdf));
      if (ctx.json) return printJson(r);
      process.stdout.write(kv({ document_id: r.document_id, name: r.name, extracted_fields: r.extracted_count ?? 0 }) + "\n");
    });

  session
    .command("archive <sessionId>")
    .description("Archive a session (hides it from the default list)")
    .action(async (sessionId) => {
      const ctx = makeCtx(program.opts());
      const r = await apiRequest<Record<string, any>>(ctx.client, "POST", `/org/sessions/${sessionId}/archive`);
      if (ctx.json) return printJson(r);
      process.stdout.write(`Archived session ${r.session_id ?? sessionId}` + (r.archived_at ? ` at ${r.archived_at}` : "") + ".\n");
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
