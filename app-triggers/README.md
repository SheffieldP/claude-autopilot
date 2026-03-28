# app-triggers

MCP server that connects Claude Code to 2,000+ apps via Pipedream. Receives real-time webhook events through Hookdeck and exposes tools for connecting apps, deploying triggers, and running actions.

## Tools

| Tool | Purpose |
|------|---------|
| `connect_app` | OAuth connect a new app |
| `get_connected_accounts` | List connected apps |
| `search_triggers` | Find available triggers for an app |
| `deploy_trigger` | Activate a trigger to watch for events |
| `list_triggers` | See all active triggers |
| `delete_trigger` | Remove a trigger |
| `search_actions` | Find available actions for an app |
| `get_action_schema` | Get required parameters for an action |
| `run_action` | Execute an action on a connected app |
