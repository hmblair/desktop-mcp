import {
  createServer as createSharedServer,
  McpServer,
  toolResponse,
  toolError,
} from "@desktop-mcp/shared";
import type { ManagedServer } from "@desktop-mcp/shared";
import { z } from "zod";
import { ThunderbirdAPI } from "./browser-api";
import { HTTP_PORT } from "../common";

function registerTools(mcpServer: McpServer, api: ThunderbirdAPI) {
  async function call(toolName: string, args: Record<string, unknown>) {
    try {
      const result = await api.callTool(toolName, args);
      return toolResponse(result);
    } catch (error) {
      return toolError(toolName, error);
    }
  }

  // Wrapper that avoids deep type inference on complex zod schemas (TS2589).
  // All Thunderbird tools funnel through call() with Record<string, unknown>,
  // so the inferred parameter types are unused.
  function tool(
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: Record<string, unknown>) => Promise<ReturnType<typeof toolResponse>>
  ) {
    mcpServer.tool(name, description, schema as any, handler as any);
  }

  tool(
    "listAccounts",
    `List all email accounts and their identities`,
    {
      includeLocal: z.boolean().optional().describe(`Include Local Folders account (default: false)`),
    },
    async (args) => call("listAccounts", args)
  );

  tool(
    "listFolders",
    `List all mail folders with paths and message counts`,
    {
      accountId: z.string().optional().describe(`Email address of the account. Internal account IDs are not exposed in responses.`),
      folderPath: z.string().optional().describe(`Folder path (e.g. 'user@example.com/Inbox') to list only that folder and its subfolders`),
      includeLocal: z.boolean().optional().describe(`Include Local Folders account (default: false)`),
    },
    async (args) => call("listFolders", args)
  );

  tool(
    "searchMessages",
    `Search messages by query, sender, recipient, subject, date range, folder, account, tags, attachments, read/flagged status, or just count them. Results are grouped by conversation thread. Use getThread with a messageId + folderPath from the results to read full message bodies.`,
    {
      query: z.string().optional().describe(`Text to search in subject, author, or recipients (default: empty, matches all)`),
      from: z.string().optional().describe(`Filter by sender name or email address (substring match)`),
      to: z.string().optional().describe(`Filter by recipient or CC name or email address (substring match)`),
      subject: z.string().optional().describe(`Filter by subject line (substring match)`),
      hasAttachments: z.boolean().optional().describe(`Only return messages with attachments (default: false)`),
      taggedWith: z.string().optional().describe(`Only return messages with this tag key (e.g. '$label1' for Important)`),
      accountId: z.string().optional().describe(`Email address of the account to limit search to. Internal account IDs are not exposed in responses. Ignored if folderPath is provided.`),
      folderPath: z.union([z.string(), z.array(z.string())]).optional().describe(`Folder path (e.g. 'user@example.com/Inbox'), or an array of them, to limit search to specific folders and their subfolders`),
      startDate: z.string().optional().describe(`Filter messages on or after this ISO 8601 date`),
      endDate: z.string().optional().describe(`Filter messages on or before this ISO 8601 date`),
      maxResults: z.coerce.number().optional().describe(`Maximum number of results to return (default 50, max 1000)`),
      sortOrder: z.string().optional().describe(`Date sort order: asc (oldest first) or desc (newest first, default)`),
      unreadOnly: z.boolean().optional().describe(`Only return unread messages (default: false)`),
      flaggedOnly: z.boolean().optional().describe(`Only return flagged/starred messages (default: false)`),
      snippetLength: z.coerce.number().optional().describe(`Include a body preview of up to this many characters (default: 0, no snippet)`),
      countOnly: z.boolean().optional().describe(`Return only the count of matching messages, not the messages themselves (default: false)`),
      scope: z.enum(["inbox", "sent", "trash", "all"]).optional().describe(`Which folders to search: "inbox" (default) excludes Trash/Junk/Sent/Drafts, "sent" searches Sent and Drafts, "trash" searches Trash and Junk/Spam, "all" searches everything. Ignored when folderPath or folderPaths is specified.`),
    },
    async (args) => call("searchMessages", args)
  );

  tool(
    "getThread",
    `Read all messages in a conversation thread with full bodies. Finds messages across all folders (Inbox, Sent, etc.) via Gloda. Provide any messageId + folderPath from searchMessages results to get the entire conversation.`,
    {
      messageId: z.string().describe(`Message ID (short hex ID from searchMessages results)`),
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox')`),
    },
    async (args) => call("getThread", args)
  );

  tool(
    "listCalendars",
    `Return the user's calendars. Each calendar is identified by a path like 'user@example.com/CalendarName' or 'Local/CalendarName'.`,
    {},
    async () => call("listCalendars", {})
  );

  tool(
    "createEvent",
    `Create a calendar event.`,
    {
      title: z.string().describe(`Event title`),
      startDate: z.string().describe(`Start date/time in ISO 8601 format`),
      endDate: z.string().optional().describe(`End date/time in ISO 8601 (defaults to startDate + 1h for timed, +1 day for all-day)`),
      location: z.string().optional().describe(`Event location`),
      description: z.string().optional().describe(`Event description`),
      calendarId: z.string().describe(`Target calendar path (e.g. 'user@example.com/Work' or 'Local/Personal') from listCalendars`),
      allDay: z.boolean().optional().describe(`Create an all-day event (default: false)`),
      recurrence: z.string().optional().describe(`iCal RRULE string for repeating events (e.g. 'FREQ=WEEKLY;BYDAY=MO,WE,FR' or 'FREQ=MONTHLY;BYMONTHDAY=15')`),
    },
    async (args) => call("createEvent", args)
  );

  tool(
    "listEvents",
    `List calendar events within a date range`,
    {
      calendarId: z.string().optional().describe(`Calendar path (e.g. 'user@example.com/Work') from listCalendars. If omitted, queries all calendars.`),
      startDate: z.string().optional().describe(`Start of date range in ISO 8601 format (default: now)`),
      endDate: z.string().optional().describe(`End of date range in ISO 8601 format (default: 30 days from startDate)`),
      maxResults: z.coerce.number().optional().describe(`Maximum number of events to return (default: 100)`),
    },
    async (args) => call("listEvents", args)
  );

  tool(
    "updateEvent",
    `Update an existing calendar event's title, dates, location, or description`,
    {
      eventId: z.string().describe(`The event ID (short hex ID from listEvents results)`),
      calendarId: z.string().describe(`Calendar path containing the event (e.g. 'user@example.com/Work') from listEvents results`),
      title: z.string().optional().describe(`New event title (optional)`),
      startDate: z.string().optional().describe(`New start date/time in ISO 8601 format (optional)`),
      endDate: z.string().optional().describe(`New end date/time in ISO 8601 format (optional)`),
      location: z.string().optional().describe(`New event location (optional)`),
      description: z.string().optional().describe(`New event description (optional)`),
      recurrence: z.string().optional().describe(`New iCal RRULE string (e.g. 'FREQ=WEEKLY;BYDAY=MO'), or empty string to remove recurrence`),
    },
    async (args) => call("updateEvent", args)
  );

  tool(
    "deleteEvent",
    `Delete a calendar event`,
    {
      eventId: z.string().describe(`The event ID (short hex ID from listEvents results)`),
      calendarId: z.string().describe(`Calendar path containing the event (e.g. 'user@example.com/Work') from listEvents results`),
    },
    async (args) => call("deleteEvent", args)
  );

  tool(
    "moveEvent",
    `Move a calendar event from one calendar to another`,
    {
      eventId: z.string().describe(`The event ID (short hex ID from listEvents results)`),
      calendarId: z.string().describe(`Calendar path currently containing the event (from listEvents results)`),
      destinationCalendarId: z.string().describe(`Calendar path to move the event to (from listCalendars)`),
    },
    async (args) => call("moveEvent", args)
  );

  tool(
    "listTasks",
    `List tasks (todos) from calendars, optionally filtered by date range and completion status`,
    {
      calendarId: z.string().optional().describe(`Calendar path (e.g. 'user@example.com/Work') from listCalendars. If omitted, queries all calendars.`),
      startDate: z.string().optional().describe(`Only include tasks due on or after this ISO 8601 date`),
      endDate: z.string().optional().describe(`Only include tasks due on or before this ISO 8601 date`),
      maxResults: z.coerce.number().optional().describe(`Maximum number of tasks to return (default: 100)`),
      includeCompleted: z.boolean().optional().describe(`Include completed tasks (default: false)`),
    },
    async (args) => call("listTasks", args)
  );

  tool(
    "createTask",
    `Create a new task (todo).`,
    {
      title: z.string().describe(`Task title`),
      dueDate: z.string().optional().describe(`Due date/time in ISO 8601 format (optional)`),
      description: z.string().optional().describe(`Task description (optional)`),
      calendarId: z.string().describe(`Target calendar path (e.g. 'user@example.com/Work' or 'Local/Personal') from listCalendars`),
      priority: z.coerce.number().optional().describe(`Priority 0-9 (0=undefined, 1=highest, 5=normal, 9=lowest)`),
    },
    async (args) => call("createTask", args)
  );

  tool(
    "updateTask",
    `Update a task's title, due date, description, priority, completion percentage, or status`,
    {
      taskId: z.string().describe(`The task ID (short hex ID from listTasks results)`),
      calendarId: z.string().describe(`Calendar path containing the task (from listTasks results)`),
      title: z.string().optional().describe(`New task title (optional)`),
      dueDate: z.string().optional().describe(`New due date in ISO 8601 format, or empty string to clear (optional)`),
      description: z.string().optional().describe(`New description (optional)`),
      priority: z.coerce.number().optional().describe(`Priority 0-9 (optional)`),
      percentComplete: z.coerce.number().optional().describe(`Completion percentage 0-100. Setting to 100 marks as completed. (optional)`),
      status: z.string().optional().describe(`Task status: NONE, NEEDS-ACTION, IN-PROCESS, COMPLETED, or CANCELLED (optional)`),
    },
    async (args) => call("updateTask", args)
  );

  tool(
    "deleteTask",
    `Delete a task (todo) from a calendar`,
    {
      taskId: z.string().describe(`The task ID (short hex ID from listTasks results)`),
      calendarId: z.string().describe(`Calendar path containing the task (from listTasks results)`),
    },
    async (args) => call("deleteTask", args)
  );

  tool(
    "moveTask",
    `Move a task (todo) from one calendar to another`,
    {
      taskId: z.string().describe(`The task ID (short hex ID from listTasks results)`),
      calendarId: z.string().describe(`Calendar path currently containing the task (from listTasks results)`),
      destinationCalendarId: z.string().describe(`Calendar path to move the task to (from listCalendars)`),
    },
    async (args) => call("moveTask", args)
  );

  tool(
    "searchContacts",
    `Find contacts the user interacted with`,
    {
      query: z.string().describe(`Email address or name to search for`),
    },
    async (args) => call("searchContacts", args)
  );

  tool(
    "deleteMessages",
    `Delete messages from a folder. Drafts are moved to Trash instead of permanently deleted.`,
    {
      messageIds: z.union([z.string(), z.array(z.string())]).describe(`Message ID or array of message IDs to delete`),
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox')`),
    },
    async (args) => call("deleteMessages", args)
  );

  tool(
    "deleteMessagesBySender",
    `Delete all messages from one or more senders across all folders in an account. Searches and deletes in one step.`,
    {
      from: z.union([z.string(), z.array(z.string())]).describe(`Sender name or email substring to match (or array of them). All messages matching any of these senders will be deleted.`),
      accountId: z.string().optional().describe(`Email address of the account to limit deletion to (optional, defaults to all accounts). Internal account IDs are not exposed in responses.`),
      scope: z.enum(["inbox", "sent", "trash", "all"]).optional().describe(`Which folders to search: 'all' (default) searches everything, 'inbox' excludes Trash/Junk/Sent/Drafts, 'sent' searches Sent/Drafts, 'trash' searches Trash/Junk`),
    },
    async (args) => call("deleteMessagesBySender", args)
  );

  tool(
    "updateMessages",
    `Update one or more messages: mark read/unread, flag/unflag, add/remove tags, move, copy, or trash.`,
    {
      messageIds: z.union([z.string(), z.array(z.string())]).describe(`Message ID or array of message IDs to update`),
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox')`),
      read: z.boolean().optional().describe(`Set to true/false to mark read/unread (optional)`),
      flagged: z.boolean().optional().describe(`Set to true/false to flag/unflag (optional)`),
      addTags: z.array(z.string()).optional().describe(`Tag keys to add (e.g. ["$label1", "$label2"]). Standard: $label1=Important, $label2=Work, $label3=Personal, $label4=To Do, $label5=Later`),
      removeTags: z.array(z.string()).optional().describe(`Tag keys to remove`),
      moveTo: z.string().optional().describe(`Destination folder path (e.g. 'user@example.com/Inbox') to move messages to. Only one of moveTo/copyTo/trash allowed.`),
      copyTo: z.string().optional().describe(`Destination folder path (e.g. 'user@example.com/Inbox') to copy messages to. Only one of moveTo/copyTo/trash allowed.`),
      trash: z.boolean().optional().describe(`Set to true to move messages to Trash. Only one of moveTo/copyTo/trash allowed.`),
    },
    async (args) => call("updateMessages", args)
  );

  tool(
    "createFolder",
    `Create a new mail subfolder under an existing folder`,
    {
      parentFolderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox') of the parent folder`),
      name: z.string().describe(`Name for the new subfolder`),
    },
    async (args) => call("createFolder", args)
  );

  tool(
    "renameFolder",
    `Rename an existing mail folder`,
    {
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox')`),
      newName: z.string().describe(`New name for the folder`),
    },
    async (args) => call("renameFolder", args)
  );

  tool(
    "deleteFolder",
    `Delete a mail folder. By default moves to Trash; set permanent=true to delete permanently.`,
    {
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox')`),
      permanent: z.boolean().optional().describe(`If true, permanently delete instead of moving to Trash (default: false)`),
    },
    async (args) => call("deleteFolder", args)
  );

  tool(
    "moveFolder",
    `Move a folder to be a subfolder of a different parent folder`,
    {
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox')`),
      destinationParentPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox') of the new parent`),
    },
    async (args) => call("moveFolder", args)
  );

  tool(
    "emptyJunk",
    `Permanently delete all messages in the Junk/Spam folder`,
    {
      accountId: z.string().optional().describe(`Email address of the account to empty junk for. If omitted, empties junk for all accounts. Internal account IDs are not exposed in responses.`),
    },
    async (args) => call("emptyJunk", args)
  );

  tool(
    "emptyTrash",
    `Permanently delete all messages in the Trash folder`,
    {
      accountId: z.string().optional().describe(`Email address of the account to empty trash for. If omitted, empties trash for all accounts. Internal account IDs are not exposed in responses.`),
    },
    async (args) => call("emptyTrash", args)
  );

  tool(
    "createDraft",
    `Save a message as a draft without opening a compose window. Can also create a reply draft by providing messageId and folderPath of the original message.`,
    {
      to: z.string().optional().describe(`Recipient email address(es). For replies, defaults to original sender.`),
      subject: z.string().optional().describe(`Email subject. For replies, defaults to 'Re: <original subject>'.`),
      body: z.string().describe(`Email body (your reply text or new message body)`),
      cc: z.string().optional().describe(`CC recipients (comma-separated). For reply-all, defaults to original recipients.`),
      bcc: z.string().optional().describe(`BCC recipients (comma-separated)`),
      isHtml: z.boolean().optional().describe(`Whether body is HTML (default: false). Ignored for reply drafts.`),
      from: z.string().optional().describe(`Sender email address to use for the draft. Must match one of your configured identities.`),
      messageId: z.string().optional().describe(`Message ID to reply to (from searchMessages). Enables reply draft mode.`),
      folderPath: z.string().optional().describe(`Folder path (e.g. 'user@example.com/Inbox') of the message to reply to (required with messageId)`),
      replyAll: z.boolean().optional().describe(`Reply to all recipients (default: false). Only used with messageId.`),
      forward: z.boolean().optional().describe(`Forward mode (default: false). When true with messageId/folderPath, creates a forward draft with original message body and attachments.`),
      attachments: z.array(z.string()).optional().describe(`Array of file paths to attach`),
    },
    async (args) => call("createDraft", args)
  );

  tool(
    "sendDraft",
    `Send a draft message. Use searchMessages on the Drafts folder to find draft message IDs.`,
    {
      messageId: z.string().describe(`The message ID of the draft (from searchMessages results)`),
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Drafts')`),
    },
    async (args) => call("sendDraft", args)
  );

  tool(
    "createFeedAccount",
    `Create a new RSS/Atom feed account`,
    {
      name: z.string().optional().describe(`Display name for the account (default: 'Feeds')`),
    },
    async (args) => call("createFeedAccount", args)
  );

  tool(
    "listFeeds",
    `List subscribed RSS/Atom feeds. Can filter by account or folder. Feed items are regular messages readable via searchMessages/getThread.`,
    {
      accountId: z.string().optional().describe(`Email address of the RSS account. Internal account IDs are not exposed in responses.`),
      folderPath: z.string().optional().describe(`Folder path (e.g. 'user@example.com/FeedFolder') to list feeds in a specific folder only`),
    },
    async (args) => call("listFeeds", args)
  );

  tool(
    "subscribeFeed",
    `Subscribe to an RSS/Atom feed URL. Creates a folder for the feed and downloads its items as messages.`,
    {
      url: z.string().describe(`The RSS/Atom feed URL to subscribe to`),
      accountId: z.string().optional().describe(`Email address of the RSS account (uses first RSS account or creates one if omitted). Internal account IDs are not exposed in responses.`),
      folderPath: z.string().optional().describe(`Specific folder to place the feed in (overrides accountId)`),
    },
    async (args) => call("subscribeFeed", args)
  );

  tool(
    "unsubscribeFeed",
    `Remove an RSS/Atom feed subscription. Removes the feed from the subscriptions database and its cached items.`,
    {
      url: z.string().describe(`The feed URL to unsubscribe from`),
      folderPath: z.string().optional().describe(`Folder path to narrow the search if the same URL exists in multiple accounts`),
    },
    async (args) => call("unsubscribeFeed", args)
  );

  tool(
    "getNewMail",
    `Check for new mail from the server. Can check a specific account or all accounts.`,
    {
      accountId: z.string().optional().describe(`Email address of the account. If omitted, checks all accounts. Internal account IDs are not exposed in responses.`),
    },
    async (args) => call("getNewMail", args)
  );

  tool(
    "refreshFeeds",
    `Trigger a feed refresh/download. Can refresh a specific folder, an entire account, or all RSS accounts.`,
    {
      accountId: z.string().optional().describe(`Email address of the RSS account (refreshes all accounts if omitted). Internal account IDs are not exposed in responses.`),
      folderPath: z.string().optional().describe(`Specific folder to refresh (overrides accountId)`),
    },
    async (args) => call("refreshFeeds", args)
  );

  tool(
    "getAttachment",
    `Download an attachment from an email message and save it to a local file. Use searchMessages with hasAttachments=true to find messages with attachments, then getThread to see attachment names.`,
    {
      messageId: z.string().describe(`Message ID (short hex ID from searchMessages results)`),
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox')`),
      attachmentName: z.string().optional().describe(`Filename of the attachment to download. If omitted and attachmentIndex is also omitted, downloads the first attachment.`),
      attachmentIndex: z.coerce.number().optional().describe(`Zero-based index of the attachment to download (alternative to attachmentName)`),
      savePath: z.string().describe(`Local file path to save the attachment to`),
    },
    async (args) => call("getAttachment", args)
  );

  tool(
    "unsubscribe",
    `Unsubscribe from a mailing list by sending a one-click unsubscribe POST request using the message's List-Unsubscribe header (RFC 8058).`,
    {
      messageId: z.string().describe(`The message ID (short hex ID from searchMessages results)`),
      folderPath: z.string().describe(`Folder path (e.g. 'user@example.com/Inbox')`),
    },
    async (args) => call("unsubscribe", args)
  );

}

export type ThunderbirdMcpServer = ManagedServer<ThunderbirdAPI>;

export function createServer(options?: { name?: string; version?: string }): ThunderbirdMcpServer {
  return createSharedServer<ThunderbirdAPI>({
    name: options?.name ?? "thunderbird-mcp",
    version: options?.version,
    httpPort: HTTP_PORT,
    createApi: () => new ThunderbirdAPI(),
    registerTools,
  });
}
