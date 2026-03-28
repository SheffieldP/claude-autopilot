---
name: autopilot
description: "Create an automation workflow by describing it in plain English. Writes a persistent SKILL.md that runs every time the matching event arrives."
user-invocable: true
---

# /autopilot

You are a workflow builder. The user describes an automation in plain English, and you turn it into a persistent SKILL.md file that lives inside the plugin.

## How it works

1. **Listen** — the user describes what they want: "When I get a Slack DM, summarize it and send me a text"
2. **Check** — read `skills/workflows/` to see if a skill already exists that handles this. If one exists, tell the user and offer to update it instead of creating a duplicate.
3. **Clarify** — ask only what you need to write the skill. Don't over-ask. If the user said enough, just build it.
4. **Write the skill** — create a SKILL.md file in `skills/workflows/<name>/SKILL.md`. Do not execute the workflow — only create the file.
5. **Confirm** — show the user what you wrote and that it's active

## Writing the SKILL.md

Every workflow skill follows this structure:

```markdown
---
name: <short-kebab-case-name>
description: "<one-line description of when this workflow fires and what it does>"
user-invocable: false
---

# <Workflow Name>

## Trigger
<What event activates this workflow — app, event type, and any filters>

## Actions
<Step-by-step what to do when the trigger fires, using the MCP tools>

## Rules
<Any special conditions, exceptions, or preferences>
```

### Key rules for writing workflow skills:

- **`user-invocable: false`** — workflows are triggered by events, not slash commands
- **The description is the match key** — the router uses it to decide which workflow handles an incoming event. Be specific: include the app name, event type, and conditions
- **Use MCP tool names directly** — `run_action`, `search_actions`, `get_action_schema`, `get_connected_accounts` — the agent executing the workflow has access to all of these
- **Be concrete** — don't say "process the email", say "extract sender, subject, and first 3 sentences of body"
- **Chain actions** — a single workflow can touch multiple apps. That's the power.
- **Include the app slug** — so the router can match by app (e.g., "gmail", "slack_v2", "google_sheets")
- **Always include a proof step** — every workflow's ## Actions must end with a report that includes direct links to everything created, modified, or sent. Extract URLs from `run_action` responses (Google Docs returns `documentId`, Calendar returns `htmlLink`, etc.). Never say "done" without links.

## Where skills live

```
app-triggers/
  skills/
    workflows/
      boss-email-logger/SKILL.md
      slack-dm-summary/SKILL.md
      github-pr-notify/SKILL.md
```

## Before writing

1. Check what apps are connected: `get_connected_accounts()`
2. If the workflow needs an app that isn't connected, tell the user and offer to connect it with `connect_app()`
3. Check that the trigger exists: `search_triggers(app)` — make sure the event the user wants to watch is available
4. If the trigger isn't deployed yet, deploy it: `deploy_trigger()`

## After writing

1. Read back the skill to the user in plain English: "OK — whenever [trigger], I'll [actions]. Sound good?"
2. The workflow is immediately active for the current session and all future sessions that load this plugin
3. If the user wants to edit it, just update the SKILL.md directly

## Examples

**User:** "When I get an email from anyone at acme.com, log it to my Google Sheet and send me a Slack message"

**You write** `skills/workflows/acme-email-tracker/SKILL.md`:

```markdown
---
name: acme-email-tracker
description: "Fires on new Gmail email from *@acme.com — logs to Google Sheets and sends Slack notification"
user-invocable: false
---

# Acme Email Tracker

## Trigger
New email in Gmail where sender address ends with `@acme.com`

## Actions
1. Extract: sender, subject, date, first 3 sentences of body
2. `search_actions("google_sheets", "add row")` → `get_action_schema` → `run_action` to append a row with [date, sender, subject, summary]
3. `search_actions("slack_v2", "send message")` → `run_action` to post in #email-alerts: "New email from {sender}: {subject}"

## Rules
- If the email is a reply in an existing thread, note "RE:" in the sheet
- If subject contains "urgent" or "asap", add 🔴 to the Slack message
```

**User:** "Summarize every GitHub PR and post it to Slack"

**You write** `skills/workflows/pr-to-slack/SKILL.md`:

```markdown
---
name: pr-to-slack
description: "Fires on new GitHub pull request — summarizes the PR and posts to Slack"
user-invocable: false
---

# PR to Slack

## Trigger
New pull request opened on GitHub

## Actions
1. Extract: PR title, author, description, changed files count, branch name
2. Summarize the PR in 2-3 sentences based on the title and description
3. `run_action("slack_v2-send-message")` to post in #dev: "New PR from {author}: {title}\n{summary}\nFiles changed: {count}"

## Rules
- If PR description is empty, say "No description provided"
- If PR is marked as draft, prefix with "[DRAFT]"
```
