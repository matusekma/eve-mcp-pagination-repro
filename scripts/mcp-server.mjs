import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const tool = (name, readOnlyHint) => ({
  name,
  description: readOnlyHint ? "A read tool on catalog page two." : "A mock write tool on catalog page one.",
  inputSchema: { type: "object", properties: {} },
  annotations: { readOnlyHint },
});
export const firstPage = Array.from({ length: 50 }, (_, index) =>
  tool("write_demo_" + String(index + 1).padStart(2, "0"), false));
export const secondPage = [tool("getJiraIssue", true), tool("searchJiraIssuesUsingJql", true)];

export async function startMockServer(port = 0) {
  const requests = [];
  const server = createServer(async (request, response) => {
    if (request.url !== "/mcp") { response.writeHead(404).end(); return; }
    if (request.method !== "POST") { response.writeHead(405).end(); return; }
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const message = JSON.parse(Buffer.concat(chunks).toString());
      requests.push({ method: message.method, cursor: message.params?.cursor ?? null });
      if (message.id === undefined) { response.writeHead(202).end(); return; }
      let result;
      if (message.method === "initialize") {
        result = { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "pagination-repro", version: "1.0.0" } };
      } else if (message.method === "tools/list") {
        result = message.params?.cursor === "page-2"
          ? { tools: secondPage }
          : { tools: firstPage, nextCursor: "page-2" };
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(result
        ? { jsonrpc: "2.0", id: message.id, result }
        : { jsonrpc: "2.0", id: message.id, error: { code: -32601, message: "Only initialization and catalog listing are supported. No tool executes." } }));
    } catch {
      response.writeHead(400).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    url: "http://127.0.0.1:" + server.address().port + "/mcp",
    requests,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mock = await startMockServer(3333);
  console.log("Mock MCP server: " + mock.url);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => void mock.close());
}
