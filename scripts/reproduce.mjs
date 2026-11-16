import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { McpConnectionClient } from "../node_modules/eve/dist/src/runtime/connections/mcp-client.js";
import { firstPage, secondPage, startMockServer } from "./mcp-server.mjs";

const { version } = JSON.parse(await readFile(new URL("../node_modules/eve/package.json", import.meta.url)));
const mock = await startMockServer();
const client = new McpConnectionClient({
  connectionName: "paginated",
  protocol: "mcp",
  protocolVersionDiscovery: false,
  url: mock.url,
});
try {
  // This is Eve's real client over HTTP: no connect/listTools methods are mocked or patched.
  const metadata = await client.getToolMetadata();
  const discoveryRequests = mock.requests.filter(request => request.method === "tools/list");
  const names = metadata.map(tool => tool.name);
  const missingTools = secondPage.map(tool => tool.name).filter(name => !names.includes(name));

  // Control: explicitly follow the cursor with the same unmodified SDK client.
  const sdk = await client.connect();
  const pageOne = await sdk.listTools();
  const pageTwo = await sdk.listTools({ params: { cursor: pageOne.nextCursor } });
  assert.equal(pageOne.tools.length + pageTwo.tools.length, firstPage.length + secondPage.length);

  console.log(JSON.stringify({
    eveVersion: version,
    nodeVersion: process.version,
    discoveryRequestedCursors: discoveryRequests.map(request => request.cursor),
    discoveredToolCount: names.length,
    expectedToolCount: firstPage.length + secondPage.length,
    missingTools,
    explicitSdkPaginationToolCount: pageOne.tools.length + pageTwo.tools.length,
  }, null, 2));
  if (process.argv.includes("--assert-complete")) {
    assert.equal(names.length, firstPage.length + secondPage.length, "Eve must discover every MCP catalog page");
  }
} finally {
  await client.close();
  await mock.close();
}
