# bindly

Run the full Bindly intake lifecycle from your terminal: start sessions, answer questions, extract from PDFs, fill ACORD forms, download them, and submit to Hedge.

## Install

Three ways to install. Pick one.

### npm (requires Node.js 18 or newer)

```bash
npm install -g bindly-cli   # provides `bindly`
```

Or run without installing:

```bash
npx bindly-cli session list
```

### Homebrew (self-contained binary, no Node required)

```bash
brew install taventech/tap/bindly
```

### curl (self-contained binary, no Node required)

```bash
curl -fsSL https://github.com/taventech/bindly-cli/releases/latest/download/install.sh | sh
```

The installer downloads the binary for your OS and CPU into `$HOME/.local/bin`. Add that directory to your `PATH` if it is not already there.

## Quickstart

```bash
bindly login                     # device-code sign in, or: bindly login --api-key bsk_...
bindly session new --insured "Acme HVAC" --state TX --lob general_liability
bindly session answer <session-id> --message "12 employees, $2.4M revenue, no claims in 5 years"
bindly session fill <session-id>
bindly session submit <session-id>
```

## Commands

| Command | What it does |
| --- | --- |
| `bindly session new --insured <name> [--state ST] [--lob a,b] [--naics code]` | Start an intake session for an insured. |
| `bindly session list` | List your workspace's sessions. |
| `bindly session get <sessionId>` | Session detail, intake progress, and the next questions. |
| `bindly session answer <sessionId> --message <text>` | Answer intake questions conversationally; returns the next asks. |
| `bindly session extract <sessionId> <pdf>` | Extract intake answers from a PDF (ACORD, dec page, supplement; 20MB max). |
| `bindly session fill <sessionId>` | Fill the session's ACORD forms from the collected answers. |
| `bindly session download <sessionId> [formKey] [-o <dir>]` | Download one filled form PDF, or all of them. |
| `bindly session risk <sessionId>` | Underwriting risk flags Bindly spotted in the intake. |
| `bindly session upload <sessionId> <pdf>` | Attach a supporting document (loss runs, prior policy). |
| `bindly session archive <sessionId>` | Archive a session. |
| `bindly session submit <sessionId>` | Submit a completed session to Hedge on your connected Hedge account. |
| `bindly whoami` | Show the signed-in workspace, plan, and auth method. |
| `bindly login` / `bindly logout` | Sign in and out. |

`session submit` forwards the session's filled ACORD forms and supplements to Hedge and returns the resulting Hedge submission id.

Add `--json` to any command for the raw API response, so the CLI composes in scripts:

```bash
bindly session list --json | jq '.sessions[] | select(.status=="ready") | .session_id'
```

## Signing in

The CLI supports three sign-in modes:

| Mode | How | When to use |
| --- | --- | --- |
| Device code (default) | `bindly login` | Anywhere, including headless servers and SSH. Prints a short code and a URL to approve in any browser. |
| Browser (loopback) | `bindly login --browser` | A local machine with a browser. Opens it and captures the redirect on `127.0.0.1`. |
| Workspace API key | `bindly login --api-key bsk_...` | Non-interactive automation with a workspace key. |

Create a workspace API key in Bindly under **Agency profile then API keys**. Credentials are stored at `~/.config/taven-cli/bindly.prod.json` with `0600` permissions. Access tokens are refreshed automatically. Sign out with `bindly logout`.

Point at a non-production engine with `BINDLY_ENGINE_URL` (and `BINDLY_APP_URL` for the approval page).

## Example: full lifecycle

```bash
# 1. Sign in with a workspace API key (keys look like bsk_...)
bindly login --api-key bsk_xxx
bindly whoami

# 2. Start a session
bindly session new --insured "Acme HVAC" --state TX --lob general_liability
# -> session_id abc123

# 3. Answer intake questions conversationally
bindly session answer abc123 --message "12 employees, $2.4M revenue, no claims in the last 5 years"

# 4. Or extract answers straight from a PDF you already have
bindly session extract abc123 ./prior-acord-125.pdf

# 5. Check what is still open, then fill the ACORD forms
bindly session get abc123
bindly session fill abc123

# 6. Download the filled PDFs and review risk flags
bindly session download abc123 -o ./filled
bindly session risk abc123

# 7. Submit to Hedge
bindly session submit abc123
```

## License

MIT. See [LICENSE](LICENSE).
