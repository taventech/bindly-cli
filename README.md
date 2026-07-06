# bindly

Start Bindly intake sessions and submit them to Hedge, from your terminal.

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
bindly session list
bindly session submit <session-id>
```

## Commands

| Command | What it does |
| --- | --- |
| `bindly session new --insured <name> [--state ST] [--lob a,b] [--naics code]` | Start an intake session for an insured. |
| `bindly session list` | List your workspace's sessions. |
| `bindly session get <sessionId>` | Session detail plus intake progress. |
| `bindly session submit <sessionId>` | Submit a completed session to Hedge on your connected Hedge account. |
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

## Example

```bash
bindly login --api-key bsk_live_xxx
bindly session new --insured "Acme HVAC" --state TX --lob general_liability
# continue filling the intake in Bindly, then:
bindly session submit <session-id>
```

## License

MIT. See [LICENSE](LICENSE).
