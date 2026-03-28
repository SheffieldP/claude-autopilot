# Claude Autopilot

A Claude Code plugin that hooks into Pipedream and Hookdeck so Claude can listen for events from your apps (Gmail, Slack, GitHub, etc.) and actually do stuff in response — send emails, post messages, create docs, whatever.

## Setup

Install deps:

```bash
cd app-triggers && bun install
```

Copy the example configs:

```bash
cp .mcp.json.example .mcp.json
cp .env.example .env
```

Fill in your Pipedream credentials (client ID, secret, project ID from [pipedream.com/settings/account](https://pipedream.com/settings/account)) and your Hookdeck webhook URL.

**Heads up on Pipedream pricing:** the free tier polls every 15 minutes, so there's a delay before events come through. The paid plan ($29/mo) gives you 15-second polling, which feels basically instant for demos and real usage.

## Running

You need two terminals.

First one starts the webhook listener:

```bash
hookdeck listen 8788 app-triggers
```

It'll print a webhook URL — put that in your `.mcp.json`.

Second one starts Claude Code with the plugin loaded:

```bash
claude --dangerously-skip-permissions --dangerously-load-development-channels server:app-triggers
```

From there, `/autopilot` gets you started — connect apps, set up triggers, create workflows. Workflows live in `skills/workflows/` as markdown files and run automatically when their trigger fires.

## Making it fully autonomous

> **Warning:** This turns Claude Code into a fully autonomous agent. It will act on incoming events, use your connected apps, and execute workflows without asking for permission. That means sending emails, posting messages, creating documents — all on its own. Use this at your own risk and make sure you've tested and trust the workflows you've set up.

By default, Claude Code asks for permission before using tools (running actions, reading files, etc.). For autopilot to work without interruptions, you need to allow tool access.

Create a file at `.claude/settings.local.json` in the project root:

```json
{
  "permissions": {
    "allow": [
      "mcp__*",
      "Bash(*)",
      "Read",
      "Edit",
      "MultiEdit",
      "Write",
      "Glob",
      "Grep",
      "WebFetch",
      "WebSearch",
      "Agent(*)"
    ]
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "app-triggers"
  ]
}
```

This tells Claude Code to allow all MCP tools (the Pipedream actions), file operations, and web access without prompting. The `enabledMcpjsonServers` line loads the app-triggers plugin automatically.

This file is gitignored so it stays local to your machine.

## What's in here

- `app-triggers/src/channel.ts` — the MCP server, this is basically the whole thing
- `app-triggers/commands/autopilot/` — the `/autopilot` slash command
- `app-triggers/skills/trigger-events/` — routes incoming events to workflows
- `skills/workflows/` — where your automations go

## License

MIT
