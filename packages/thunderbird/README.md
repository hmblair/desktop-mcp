# Thunderbird MCP

Give your AI assistant full access to Thunderbird — read and organize mail, manage calendars and tasks, compose messages, and look up contacts. All through the [Model Context Protocol](https://modelcontextprotocol.io/).

Originally forked from [TKasperczyk/thunderbird-mcp](https://github.com/TKasperczyk/thunderbird-mcp).

---

## How it works

```
                    HTTP                   native messaging
  MCP Client  <----------->  Server  <--------------------->  Thunderbird
  (Claude, etc.)           native-host.js                    Extension
```

The Node.js server exposes MCP over Streamable HTTP on `localhost:8766/mcp`. It communicates with the Thunderbird extension via native messaging. Your AI talks HTTP, the server translates to native messaging, the extension executes operations against Thunderbird's APIs.

---

## Tools

### Mail

| Tool | Description |
|------|-------------|
| `listAccounts` | List all email accounts and their identities |
| `listFolders` | Browse folder tree with message counts — filter by account or subtree |
| `searchMessages` | Search messages by query, sender, recipient, subject, date range, folder, account, tags, attachments, read/flagged status, or just count them |
| `getThread` | Read all messages in a conversation thread with full bodies — finds messages across folders via Gloda |
| `updateMessages` | Mark read/unread, flag/unflag, tag, move, copy, or trash (single or bulk) |
| `getNewMail` | Check for new mail from the server — one account or all at once |
| `deleteMessages` | Delete messages from a folder |
| `deleteMessagesBySender` | Delete all messages from one or more senders across all folders |
| `getAttachment` | Download an email attachment and save it to a local file |
| `unsubscribe` | Unsubscribe from a mailing list via one-click POST (RFC 8058) |

### Compose

| Tool | Description |
|------|-------------|
| `createDraft` | Save a new message, reply, or forward as a draft — fully headless, no compose window |
| `sendDraft` | Send a draft message by its ID — use `searchMessages` on the Drafts folder to find drafts |

Drafts are saved directly to the Drafts folder. Supports new messages, replies (with threading and quoted text), and forwards (with original attachments). Add file attachments to any mode.

> **EWS/Exchange limitation:** `sendDraft` sends mail correctly via SMTP but cannot save a copy to the Sent folder on EWS accounts. This is a limitation of the underlying `nsIMsgSend` API with EWS. IMAP accounts are unaffected.

### Folders

| Tool | Description |
|------|-------------|
| `createFolder` | Create new subfolders to organize your mail |
| `renameFolder` | Rename an existing mail folder |
| `deleteFolder` | Delete a folder (moves to Trash by default) |
| `moveFolder` | Move a folder under a different parent |
| `emptyTrash` | Permanently delete all messages in Trash |
| `emptyJunk` | Permanently delete all messages in Junk/Spam |

### Calendar

| Tool | Description |
|------|-------------|
| `listCalendars` | List all calendars (local and CalDAV) |
| `listEvents` | List events within a date range |
| `createEvent` | Create a calendar event (supports recurring events via RRULE) |
| `updateEvent` | Update an event's title, dates, location, description, or recurrence |
| `deleteEvent` | Delete a calendar event |
| `moveEvent` | Move an event between calendars |

### Tasks

| Tool | Description |
|------|-------------|
| `listTasks` | List todos from calendars, filtered by date range and completion status |
| `createTask` | Create a todo |
| `updateTask` | Update a task's title, due date, priority, status, or completion percentage |
| `deleteTask` | Delete a task |
| `moveTask` | Move a task between calendars |

### Contacts

| Tool | Description |
|------|-------------|
| `searchContacts` | Look up contacts by name or email address |

### Feeds

| Tool | Description |
|------|-------------|
| `listFeeds` | List subscribed RSS/Atom feeds |
| `subscribeFeed` | Subscribe to an RSS/Atom feed URL |
| `unsubscribeFeed` | Remove a feed subscription and its cached items |
| `refreshFeeds` | Trigger a feed refresh for a folder, account, or all RSS accounts |
| `createFeedAccount` | Create a new RSS/Atom feed account |

Feed items are stored as regular messages — use `searchMessages` and `getThread` to read them.

### Account identifiers

**Email addresses are the only account identifier used in the public API.** All tools that accept an account identifier accept:

- **Email address**: `user@example.com` (the only supported input format)

The internal Thunderbird account ID (e.g., `account5`) is **not exposed** in any responses.

### Folder paths

All tools that accept a `folderPath` (or `parentFolderPath`, `moveTo`, `copyTo`, `destinationParentPath`) use the format:

- **`email/FolderName/Subfolder`**: e.g. `user@example.com/Inbox`, `user@gmail.com/[Gmail]/All Mail`

Folder names are matched case-insensitively. Use `listAccounts` to find accounts and `listFolders` to see folder paths.

### Mutation responses

Thunderbird's mail APIs are fire-and-forget — they do not return success or failure signals. All mutation tools reflect this honestly:

- Responses say `"Requested ..."` rather than claiming success
- To confirm an operation took effect, query the relevant data after the mutation

---

## Setup

Requires [Thunderbird](https://www.thunderbird.net/) 102 or later.

### 1. Install the extension

```bash
git clone https://github.com/hmblair/desktop-mcp.git
cd desktop-mcp
npm install
npm run build -w packages/shared
npm run build -w packages/thunderbird
```

Then install `packages/thunderbird/dist/thunderbird-mcp.xpi` in Thunderbird (Tools > Add-ons > Install from File) and restart.

### 2. Configure your MCP client

```bash
cd packages/thunderbird
make install
```

This registers the native messaging host and adds `thunderbird-mcp` to your MCP client configs (Claude Code and/or OpenCode).

To remove:

```bash
make uninstall
```

### 3. Headless mode (optional)

Run Thunderbird on a virtual display (Xvfb) so MCP agents can access mail and calendar when no graphical session is active.

```bash
make install-headless
```

```bash
thunderbird-headless start    # Start the service
thunderbird-headless stop     # Stop the service
thunderbird-headless status   # Show service status
```

To remove:

```bash
make uninstall-headless
```

---

## Security

The MCP server listens on `localhost:8766` only. Communication between the server and the extension uses native messaging (stdin/stdout), which is restricted to the specific extension ID registered in the native host manifest.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Extension not loading | Check Tools > Add-ons and Themes. Errors: Tools > Developer Tools > Error Console |
| Native host not connecting | Run `make install` to register the native messaging host manifest |
| Missing recent emails | Use `getNewMail` to fetch from the server, or click the folder in Thunderbird to sync |
| Tool not found after update | Reconnect MCP (`/mcp` in Claude Code) to pick up new tools |

---

## Development

```bash
# Build everything
npm run build -w packages/shared
npm run build -w packages/thunderbird
cd packages/thunderbird && make

# Install XPI in Thunderbird (Tools > Add-ons > Install from File), then restart

# Run smoke tests
npm run test -w packages/thunderbird
```

After changing extension code: rebuild the XPI, reinstall in Thunderbird, and restart.

---

## Known issues

- IMAP folder databases can be stale until you click on them in Thunderbird
- Email bodies with control characters are sanitized to avoid breaking JSON
- HTML-only emails are converted to plain text (original formatting is lost)
- **EWS (Exchange) drafts**: Drafts created via `createDraft` on EWS accounts may not delete properly through `deleteMessages` or the Thunderbird UI. **Do not use "Repair Folder" on the EWS Drafts folder** — it can permanently remove the folder from the local cache, requiring an account re-add to restore it. This is a Thunderbird EWS backend limitation.

---

## License

MIT
