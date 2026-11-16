# Eve MCP tool-catalog pagination reproduction

Reproduces missing tools after the first MCP catalog page in **eve 1.0.0**.
Created from the official `eve init` scaffold, with one mock MCP connection and a loopback-only server. No project data, API tokens, model credentials, or external services are needed for the deterministic reproduction.

## Run

Requires Node.js 26 and npm.

```bash
npm ci --ignore-scripts
npm run reproduce
```

If your local npm minimum-release-age policy blocks this newly published version, use a command-scoped override for this isolated reproduction only:

```bash
npm_config_min_release_age=0 npm ci --ignore-scripts
```

Dependency lifecycle scripts are not needed. The Eve version is pinned in package.json and package-lock.json.

## Actual result

```json
{
  "eveVersion": "1.0.0",
  "nodeVersion": "v26.13.0",
  "discoveryRequestedCursors": [null],
  "discoveredToolCount": 50,
  "expectedToolCount": 52,
  "missingTools": ["getJiraIssue", "searchJiraIssuesUsingJql"],
  "explicitSdkPaginationToolCount": 52
}
```

The Node version reflects the runtime executing the script.

## Expected behavior

Eve should request both the initial catalog page and cursor `page-2`, discovering all 52 tools. It should not lose the two read tools on page two.

`npm test` asserts that complete-catalog behavior. **It intentionally fails on the affected Eve release**, reporting `Eve must discover every MCP catalog page` (50 !== 52). After an upstream fix, the assertion should pass.

```bash
npm test
npm run typecheck
```

## How it works

- `scripts/mcp-server.mjs` starts a real stateless MCP HTTP endpoint bound to `127.0.0.1`. Its first `tools/list` page returns 50 mock write-tool definitions plus `nextCursor: "page-2"`; page two returns two read-tool definitions.
- `scripts/reproduce.mjs` uses the actual installed `McpConnectionClient` and its actual SDK over HTTP. No methods are mocked or patched. The script records the catalog requests and discovered metadata.
- As a control, the script explicitly requests page two using the same SDK client and verifies that both server pages return all 52 tools.
- No `tools/call` request is made. The mock rejects tool execution, and the script closes the client and server before exiting.

The direct import of Eve's internal connection client is intentional: it isolates the failing discovery path from model behavior, authentication, and provider configuration. The pinned dependency makes that internal import reproducible.

## Optional interactive reproduction

`agent/connections/paginated.ts` connects to the same mock at port 3333:

```bash
npm run mcp:server
# In another terminal, with your own model credentials if needed:
npm run dev
```

Ask the agent to find `paginated__getJiraIssue` or `paginated__searchJiraIssuesUsingJql`. On the affected release, neither is discovered. The deterministic `npm run reproduce` command does not need this optional model-based flow.

## Upstream context

[vercel/eve PR #3232](https://github.com/vercel/eve/pull/3232) describes the same missing pagination, including Atlassian MCP's `?tools=all` catalog. That PR was closed without merging under the contribution policy.

This is a bug-report fixture, not a production app. It deliberately retains the official scaffold dependencies rather than changing them as part of a separate dependency-upgrade investigation. Never add real credentials or expose the mock server publicly.

Dependency audit (2026-11-16): the scaffold reports four high findings along the unused `@vercel/connect` → `@vercel/oidc` → `@vercel/cli-config` → Zod chain ([GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)). This reproduction has no OAuth/token flow and processes only fixed tool definitions from its local mock; it does not validate untrusted oversized collections through that chain. Remediation is deferred to a separate scaffold/dependency update rather than changing dependencies in the pagination reproduction. Reassess before any other use.
