import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PipedreamClient } from "@pipedream/sdk";

const PIPEDREAM_CLIENT_ID = process.env.PIPEDREAM_CLIENT_ID || "";
const PIPEDREAM_CLIENT_SECRET = process.env.PIPEDREAM_CLIENT_SECRET || "";
const PIPEDREAM_PROJECT_ID = process.env.PIPEDREAM_PROJECT_ID || "";
const PIPEDREAM_PROJECT_ENV = process.env.PIPEDREAM_PROJECT_ENV || "development";
const EXTERNAL_USER_ID = process.env.PIPEDREAM_EXTERNAL_USER_ID || "";
const HOOKDECK_WEBHOOK_URL = process.env.HOOKDECK_WEBHOOK_URL || "";
const HTTP_PORT = parseInt(process.env.TRIGGER_HTTP_PORT || "8788", 10);

const pipedream = new PipedreamClient({
  clientId: PIPEDREAM_CLIENT_ID,
  clientSecret: PIPEDREAM_CLIENT_SECRET,
  projectId: PIPEDREAM_PROJECT_ID,
  projectEnvironment: PIPEDREAM_PROJECT_ENV as "development" | "production",
});

const mcp = new Server(
  { name: "claude-autopilot", version: "0.1.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} },
      tools: {},
    },
    instructions: `You are receiving real-time events from connected apps AND can take actions on those apps.

EARS (Triggers) — receive events:
- search_triggers: Find available triggers for any app
- deploy_trigger: Set up a trigger to watch for events
- list_triggers / delete_trigger: Manage active triggers

HANDS (Actions) — take action on any connected app:
- search_actions: Find available actions for any app (send email, post message, create record, etc.)
- run_action: Execute an action using the connected app's OAuth token
- get_action_schema: Get the full parameter schema for a specific action

SETUP:
- connect_app: Start OAuth flow to connect a new app
- get_connected_accounts: See all connected apps and their auth provision IDs

When an event arrives via <channel source="claude-autopilot">, read it and act if appropriate.
When a user asks to DO something (send, post, create, update, delete), use search_actions + run_action.
When a user asks to WATCH something, use search_triggers + deploy_trigger.
If the app isn't connected yet, use connect_app first.`,
  }
);

const tools = [
  {
    name: "search_triggers",
    description:
      "Search for available triggers for a given app. Returns trigger names, IDs, and whether they are instant (webhook) or polling.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app: {
          type: "string",
          description:
            "The app slug (e.g. 'gmail', 'slack_v2', 'stripe', 'hubspot', 'github'). Use lowercase with underscores.",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "connect_app",
    description:
      "Initiate an OAuth connection for a third-party app via Pipedream Connect. Returns a URL the user must open in their browser to authorize the app.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app: {
          type: "string",
          description: "The app slug to connect (e.g. 'gmail', 'slack_v2', 'stripe').",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "deploy_trigger",
    description:
      "Deploy a trigger to start watching for events. The trigger will send events to this channel. For polling triggers, defaults to 15-second intervals.",
    inputSchema: {
      type: "object" as const,
      properties: {
        trigger_id: {
          type: "string",
          description:
            "The trigger component ID from search_triggers (e.g. 'gmail-new-email-received').",
        },
        app: {
          type: "string",
          description: "The app slug (e.g. 'gmail').",
        },
        auth_provision_id: {
          type: "string",
          description:
            "The auth provision ID for the connected app account (e.g. 'apn_XXXXXXX'). Get this from connect_app or list existing connections.",
        },
        config: {
          type: "object",
          description:
            "Optional additional configured props for the trigger (e.g. labels, filters, channels). Pass as key-value pairs matching the trigger's configurable props.",
        },
        polling_interval_seconds: {
          type: "number",
          description:
            "Polling interval in seconds for polling-based triggers. Defaults to 15. Minimum is 15 on paid plans.",
        },
      },
      required: ["trigger_id", "app", "auth_provision_id"],
    },
  },
  {
    name: "list_triggers",
    description:
      "List all currently deployed (active) triggers for this user. Shows trigger ID, app, event type, and status.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "delete_trigger",
    description: "Delete a deployed trigger by its ID. Stops watching for those events.",
    inputSchema: {
      type: "object" as const,
      properties: {
        trigger_id: {
          type: "string",
          description: "The deployed trigger ID to delete (e.g. 'dc_1guZ7J6').",
        },
      },
      required: ["trigger_id"],
    },
  },
  {
    name: "get_connected_accounts",
    description:
      "List all connected app accounts for this user. Shows app name and auth provision ID needed for deploying triggers and running actions.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "search_actions",
    description:
      "Search for available actions for a given app. Returns action IDs and descriptions.",
    inputSchema: {
      type: "object" as const,
      properties: {
        app: {
          type: "string",
          description:
            "The app slug (e.g. 'gmail', 'slack_v2', 'stripe', 'hubspot', 'github', 'google_sheets'). Use lowercase with underscores.",
        },
        query: {
          type: "string",
          description:
            "Optional search query to filter actions (e.g. 'send', 'create', 'update'). Leave empty to list all.",
        },
      },
      required: ["app"],
    },
  },
  {
    name: "get_action_schema",
    description:
      "Get the full parameter schema for a specific action. Use this to understand what props/fields an action requires before running it.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action_id: {
          type: "string",
          description:
            "The action component key (e.g. 'gmail-send-email', 'slack_v2-send-message'). Get this from search_actions.",
        },
      },
      required: ["action_id"],
    },
  },
  {
    name: "run_action",
    description:
      "Execute an action on a connected app. Use search_actions to find the action ID and get_action_schema to see required props.",
    inputSchema: {
      type: "object" as const,
      properties: {
        action_id: {
          type: "string",
          description:
            "The action component key (e.g. 'gmail-send-email', 'slack_v2-send-message').",
        },
        app: {
          type: "string",
          description: "The app slug (e.g. 'gmail', 'slack_v2').",
        },
        auth_provision_id: {
          type: "string",
          description:
            "The auth provision ID for the connected account. Get from get_connected_accounts.",
        },
        props: {
          type: "object",
          description:
            "Action parameters as key-value pairs. Use get_action_schema to see what's required. Example for gmail-send-email: { to: ['user@email.com'], subject: 'Hello', body: 'Hi there' }",
        },
      },
      required: ["action_id", "app", "auth_provision_id", "props"],
    },
  },
];

async function handleSearchTriggers(args: { app: string }) {
  const response = await pipedream.triggers.list({ app: args.app, limit: 100 });
  const triggers = (response as any).data || [];

  if (triggers.length === 0) {
    return { content: [{ type: "text" as const, text: `No triggers found for app "${args.app}". Check the app slug is correct.` }] };
  }

  const results = triggers.map((t: any) => {
    const props = t.configurableProps || t.configurable_props || [];
    const hasTimer = props.some((p: any) => p.type === "$.interface.timer");
    const hasHttp = props.some((p: any) => p.type === "$.interface.http");
    const mode = hasHttp && !hasTimer ? "instant" : hasTimer && !hasHttp ? "polling" : "configurable";

    const configurableFields = props
      .filter((p: any) => !["$.interface.timer", "$.interface.http", "$.service.db"].includes(p.type) && p.name !== "db" && p.type !== "app")
      .map((p: any) => ({
        name: p.name,
        type: p.type,
        description: p.description || p.label || "",
        required: !p.optional,
        options: p.options || undefined,
      }));

    return {
      id: t.nameSlug || t.name_slug || t.key,
      name: t.name || t.nameSlug,
      mode,
      configurable_fields: configurableFields,
    };
  });

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify(results, null, 2),
    }],
  };
}

async function handleConnectApp(args: { app: string }) {
  try {
    const tokenResponse = await pipedream.tokens.create({
      externalUserId: EXTERNAL_USER_ID,
    });

    const connectUrl = (tokenResponse as any).connectLinkUrl || (tokenResponse as any).connect_link_url;
    const separator = connectUrl?.includes("?") ? "&" : "?";
    const appUrl = connectUrl ? `${connectUrl}${separator}app=${args.app}` : null;

    if (appUrl) {
      return {
        content: [{
          type: "text" as const,
          text: `Open this URL in your browser to connect ${args.app}:\n\n${appUrl}\n\nOnce connected, use get_connected_accounts to find the auth provision ID.`,
        }],
      };
    }

    return {
      content: [{
        type: "text" as const,
        text: `Token created but could not generate connect URL. Token response: ${JSON.stringify(tokenResponse)}`,
      }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Failed to connect app: ${err.message}` }],
      isError: true,
    };
  }
}

async function handleDeployTrigger(args: {
  trigger_id: string;
  app: string;
  auth_provision_id: string;
  config?: Record<string, any>;
  polling_interval_seconds?: number;
}) {
  const webhookUrl = HOOKDECK_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      content: [{
        type: "text" as const,
        text: "No HOOKDECK_WEBHOOK_URL configured. Start Hookdeck with: hookdeck listen 8788 claude-autopilot",
      }],
      isError: true,
    };
  }

  const configuredProps: Record<string, any> = {
    [args.app]: { authProvisionId: args.auth_provision_id },
    ...(args.config || {}),
  };

  const interval = args.polling_interval_seconds || 15;
  configuredProps.timer = { intervalSeconds: interval };

  try {
    const result = await pipedream.triggers.deploy({
      id: args.trigger_id,
      externalUserId: EXTERNAL_USER_ID,
      configuredProps,
      webhookUrl,
      emitOnDeploy: false,
    });

    const data = (result as any).data || result;
    const timerConfig = data.configuredProps?.timer;
    const intervalStr = timerConfig?.interval_seconds
      ? `${timerConfig.interval_seconds}s`
      : "instant";

    return {
      content: [{
        type: "text" as const,
        text: `Trigger deployed successfully!\n\nID: ${data.id}\nApp: ${args.app}\nTrigger: ${args.trigger_id}\nMode: ${intervalStr}\nWebhook: ${webhookUrl}\n\nEvents will now flow into this channel.`,
      }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Failed to deploy trigger: ${err.message}` }],
      isError: true,
    };
  }
}

async function handleListTriggers() {
  try {
    const response = await pipedream.deployedTriggers.list({
      externalUserId: EXTERNAL_USER_ID,
    });
    const triggers = (response as any).data || [];

    if (triggers.length === 0) {
      return { content: [{ type: "text" as const, text: "No active triggers." }] };
    }

    const results = triggers.map((t: any) => ({
      id: t.id,
      component: t.componentKey || t.component_key,
      active: t.active,
      polling_interval: t.configuredProps?.timer?.interval_seconds
        ? `${t.configuredProps.timer.interval_seconds}s`
        : "instant",
      created: t.createdAt || t.created_at,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Failed to list triggers: ${err.message}` }],
      isError: true,
    };
  }
}

async function handleDeleteTrigger(args: { trigger_id: string }) {
  try {
    await pipedream.deployedTriggers.delete(args.trigger_id, {
      externalUserId: EXTERNAL_USER_ID,
    });
    return {
      content: [{ type: "text" as const, text: `Trigger ${args.trigger_id} deleted.` }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Failed to delete trigger: ${err.message}` }],
      isError: true,
    };
  }
}

async function handleGetConnectedAccounts() {
  try {
    const response = await pipedream.accounts.list({
      externalUserId: EXTERNAL_USER_ID,
    });
    const accounts = (response as any).data || [];

    if (accounts.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No connected accounts. Use connect_app to connect one." }],
      };
    }

    const results = accounts.map((a: any) => ({
      id: a.id,
      app: a.app?.name_slug || a.app?.name || "unknown",
      name: a.name,
      created: a.createdAt || a.created_at,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Failed to list accounts: ${err.message}` }],
      isError: true,
    };
  }
}

async function handleSearchActions(args: { app: string; query?: string }) {
  try {
    const allActions: any[] = [];
    let after: string | undefined;

    do {
      const response = await (pipedream as any).actions.list({
        app: args.app,
        limit: 100,
        ...(after ? { after } : {}),
      });
      const data = (response as any).data || [];
      allActions.push(...data);
      after = data.length === 100 ? data[data.length - 1]?.id : undefined;
    } while (after);

    if (allActions.length === 0) {
      return {
        content: [{
          type: "text" as const,
          text: `No actions found for app "${args.app}". Check the app slug is correct.`,
        }],
      };
    }

    let filtered = allActions;
    if (args.query) {
      const q = args.query.toLowerCase();
      filtered = allActions.filter(
        (a: any) =>
          (a.name || "").toLowerCase().includes(q) ||
          (a.description || "").toLowerCase().includes(q) ||
          (a.key || a.nameSlug || "").toLowerCase().includes(q)
      );
    }

    const results = filtered.map((a: any) => ({
      id: a.key || a.nameSlug || a.name_slug,
      name: a.name,
      description: a.description || "",
    }));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(results, null, 2),
      }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Failed to search actions: ${err.message}` }],
      isError: true,
    };
  }
}

async function handleGetActionSchema(args: { action_id: string }) {
  try {
    const response = await (pipedream as any).components.retrieve(args.action_id);
    const data = (response as any).data || response;
    const props = data.configurableProps || data.configurable_props || [];

    const userProps = props
      .filter(
        (p: any) =>
          p.type !== "app" &&
          !["$.interface.timer", "$.interface.http", "$.service.db"].includes(p.type) &&
          p.name !== "db"
      )
      .map((p: any) => ({
        name: p.name,
        type: p.type,
        description: p.description || p.label || "",
        required: !p.optional,
        default: p.default,
        options: p.options || undefined,
      }));

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify(
          {
            action: args.action_id,
            name: data.name,
            description: data.description || "",
            props: userProps,
          },
          null,
          2
        ),
      }],
    };
  } catch (err: any) {
    return {
      content: [{ type: "text" as const, text: `Failed to get action schema: ${err.message}` }],
      isError: true,
    };
  }
}

async function handleRunAction(args: {
  action_id: string;
  app: string;
  auth_provision_id: string;
  props: Record<string, any>;
}) {
  try {
    // Pipedream expects camelCase auth keys (e.g. google_sheets -> googleSheets)
    const appKey = args.app.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    const configuredProps: Record<string, any> = {
      [appKey]: { authProvisionId: args.auth_provision_id },
      ...args.props,
    };

    const result = await (pipedream as any).actions.run({
      id: args.action_id,
      externalUserId: EXTERNAL_USER_ID,
      configuredProps,
    });

    const data = (result as any).data || (result as any).ret || result;

    return {
      content: [{
        type: "text" as const,
        text: `Action executed successfully!\n\n${JSON.stringify(data, null, 2)}`,
      }],
    };
  } catch (err: any) {
    if (err.status === 401 || err.message?.includes("401")) {
      return {
        content: [{
          type: "text" as const,
          text: `OAuth token expired for ${args.app}. The user needs to reconnect: use connect_app("${args.app}") to get a new auth URL.`,
        }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: `Failed to run action: ${err.message}` }],
      isError: true,
    };
  }
}

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

mcp.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "search_triggers":
      return handleSearchTriggers(args as { app: string });
    case "connect_app":
      return handleConnectApp(args as { app: string });
    case "deploy_trigger":
      return handleDeployTrigger(args as any);
    case "list_triggers":
      return handleListTriggers();
    case "delete_trigger":
      return handleDeleteTrigger(args as { trigger_id: string });
    case "get_connected_accounts":
      return handleGetConnectedAccounts();
    case "search_actions":
      return handleSearchActions(args as { app: string; query?: string });
    case "get_action_schema":
      return handleGetActionSchema(args as { action_id: string });
    case "run_action":
      return handleRunAction(args as any);
    default:
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

const transport = new StdioServerTransport();
await mcp.connect(transport);

Bun.serve({
  port: HTTP_PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    if (req.method === "POST") {
      const body = await req.text();
      let parsed: any;
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = { raw: body };
      }

      await mcp.notification({
        method: "notifications/claude/channel",
        params: {
          content: JSON.stringify(
            {
              app: parsed.app || parsed.component_key || "unknown",
              event_type: parsed.event_type || parsed.name || "event",
              timestamp: parsed.timestamp || new Date().toISOString(),
              data: parsed.data || parsed,
            },
            null,
            2
          ),
          meta: {
            source: parsed.app || parsed.component_key || "claude_autopilot",
            event_type: parsed.event_type || parsed.name || "event",
          },
        },
      });

      return new Response("ok");
    }

    return new Response("claude-autopilot channel running");
  },
});

console.error(`[claude-autopilot] Channel server running`);
console.error(`[claude-autopilot] HTTP listener on http://127.0.0.1:${HTTP_PORT}`);
console.error(`[claude-autopilot] Hookdeck URL: ${HOOKDECK_WEBHOOK_URL || "NOT SET"}`);
