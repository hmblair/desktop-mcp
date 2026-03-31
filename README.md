# Desktop MCP

MCP servers for desktop applications — give AI assistants access to Thunderbird (email, calendar, contacts) and Firefox (browser automation).

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [thunderbird-mcp](packages/thunderbird/) | Email, calendar, tasks, contacts, feeds via Thunderbird | `npm i thunderbird-mcp` |
| [firefox-mcp](packages/firefox/) | Browser automation via Firefox | `npm i firefox-mcp` |
| [@desktop-mcp/shared](packages/shared/) | Shared backend: native messaging, MCP server factory, install helpers | internal |

## Architecture

Both packages follow the same pattern:

```
MCP Client  <--HTTP-->  Node.js Server  <--native messaging-->  Browser Extension
```

- **Streamable HTTP** transport (MCP SDK) between AI client and server
- **Native messaging** (stdin/stdout, 4-byte framed) between server and extension
- Shared `BaseBrowserAPI` class handles correlation-ID-based request/response
- Shared `createServer` factory sets up McpServer + HTTP + plugin loading

## Quick start

```bash
git clone https://github.com/hmblair/desktop-mcp.git
cd desktop-mcp
npm install
npm run build -w packages/shared

# Thunderbird
npm run build -w packages/thunderbird
cd packages/thunderbird && make && make install

# Firefox
npm run build -w packages/firefox
cd packages/firefox && make && make install
```

See each package's README for detailed setup instructions.

## Development

```bash
npm run build -w packages/shared      # Build shared (required first)
npm run build -w packages/firefox     # Build firefox server + extension
npm run build -w packages/thunderbird # Build thunderbird server
npm run test -w packages/firefox      # Smoke test firefox
npm run test -w packages/thunderbird  # Smoke test thunderbird
```

## License

MIT. See [LICENSE](LICENSE) and individual package licenses.
