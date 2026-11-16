import { defineMcpClientConnection } from "eve/connections";

// Optional interactive reproduction: run npm run mcp:server, then eve dev.
export default defineMcpClientConnection({
  url: "http://127.0.0.1:3333/mcp",
  protocolVersionDiscovery: false,
  description: "A mock MCP catalog: 50 write_demo tools on page one, getJiraIssue and searchJiraIssuesUsingJql on page two. No tool executes.",
});
