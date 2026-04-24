# Google AI Agent Integration Plan

Last updated: 2026-04-24

## Goal

Add a chat UI to WindAppForGreg that lets a user talk with an AI weather agent backed by Google AI Studio / Gemini API, configured for a Gemma 4 model when the model ID is available. The agent should use our existing API as first-party tools, and should also be able to use Z.AI Web Search and Web Reader MCP servers for current external research.

## Current Repo Fit

The existing shape is a good fit for a server-owned agent:

- `apps/web` owns React UI and already calls the Worker through tRPC.
- `apps/server` owns external API access and already has adapter boundaries under `src/adapters`.
- `packages/contracts` owns shared Zod schemas for tRPC inputs.
- Cloudflare Worker secrets and bindings already live behind `apps/server/wrangler.toml`.

The agent should follow the same rule as weather.gov: the browser talks only to our Worker, never directly to Google, Z.AI, or external MCP servers.

## External Documentation Notes

- Google’s recommended JavaScript/TypeScript integration path is `@google/genai`.
- `@google/genai` supports `generateContent`, `generateContentStream`, and function declarations for tool use.
- Gemini function calling returns structured function calls that the application must execute and pass back to the model as tool responses.
- Z.AI’s documentation index is at `https://docs.z.ai/llms.txt`; the relevant pages are Web Search MCP Server and Web Reader MCP Server.
- Z.AI Web Search MCP exposes `webSearchPrime` over `https://api.z.ai/api/mcp/web_search_prime/mcp`.
- Z.AI Web Reader MCP exposes `webReader` over `https://api.z.ai/api/mcp/web_reader/mcp`.
- The MCP TypeScript SDK supports remote Streamable HTTP clients and `listTools` / `callTool`.

Open implementation checkpoint: confirm the exact Google model ID for “Gemma 4” before coding. The public Google model list page checked during planning did not show a Gemma entry, while third-party and recent release references claim Gemma 4 availability in AI Studio. Treat the model as configuration, not a hard-coded constant.

## Target Architecture

```text
apps/web chat UI
  -> /trpc/agent.*
    -> apps/server agent orchestrator
      -> Google GenAI SDK
      -> first-party tool registry
        -> weather.gov adapter / existing tRPC domain services
      -> MCP client registry
        -> Z.AI Web Search MCP
        -> Z.AI Web Reader MCP
```

## Environment And Secrets

Add Worker secrets, not client-side env vars:

- `GOOGLE_AI_API_KEY`: Google AI Studio / Gemini API key.
- `GOOGLE_AI_MODEL`: default to the verified Gemma 4 model ID once confirmed.
- `ZAI_API_KEY`: Z.AI API key for both MCP endpoints.
- Optional `AGENT_MAX_TOOL_ROUNDS`: default `4`.
- Optional `AGENT_ENABLE_WEB_TOOLS`: default `true` outside tests.

Use `wrangler secret put` for production and local `.dev.vars` for local development. Do not add these values to `wrangler.toml`.

## Server Implementation Plan

1. Add contracts.
   - Create `packages/contracts/src/agent/schemas.ts`.
   - Define `AgentMessageSchema`, `AgentChatInputSchema`, `AgentChatResponseSchema`, `AgentToolCallSchema`, and `AgentToolResultSchema`.
   - Export them from `packages/contracts/src/index.ts`.
   - Keep contracts schema-only.

2. Add Google adapter.
   - Create `apps/server/src/adapters/google-ai/client.ts`.
   - Wrap `@google/genai` behind a small `GoogleAiClient`.
   - Support non-streaming first; leave the adapter API shaped so streaming can be added without changing the UI contract.
   - Read model and API key from Worker env.
   - Keep the model ID configurable so Gemma 4 can be swapped or corrected without code changes.

3. Add MCP adapter.
   - Create `apps/server/src/adapters/mcp/zai.ts`.
   - Use `@modelcontextprotocol/sdk` Streamable HTTP client.
   - Connect to:
     - `https://api.z.ai/api/mcp/web_search_prime/mcp`
     - `https://api.z.ai/api/mcp/web_reader/mcp`
   - Add `Authorization: Bearer ${ZAI_API_KEY}` headers.
   - Implement typed wrappers:
     - `searchWeb(query, options)` -> calls `webSearchPrime`.
     - `readWebPage(url, options)` -> calls `webReader`.
   - Add connection timeout and tool-result size limits.

4. Add first-party agent tools.
   - Create `apps/server/src/services/agent/tools.ts`.
   - Expose weather functions as model-callable tools:
     - `get_hourly_wind_for_zip`
     - `get_forecast_for_zip`
     - `get_active_alerts_for_zip`
     - `resolve_zip_location`
   - Reuse existing weather adapter/service code instead of calling tRPC internally.
   - Validate every tool input with Zod schemas from `packages/contracts`.
   - Return compact, model-friendly JSON instead of full raw weather.gov payloads unless the user asks for detail.

5. Add agent orchestrator.
   - Create `apps/server/src/services/agent/run-agent.ts`.
   - Build the system prompt around this app’s domain: weather, wind forecasts, alerts, source citation, and tool-use boundaries.
   - Send Google function declarations for first-party tools plus MCP-backed tools.
   - Loop:
     - call model
     - execute requested tool calls
     - append tool responses
     - call model again
   - Stop at max tool rounds and return a graceful partial answer if exceeded.
   - Include a response metadata block with tool calls and source URLs for UI rendering/debugging.

6. Add tRPC router.
   - Create `apps/server/src/trpc/routers/agent.ts`.
   - Add `agent.chat` mutation for the first version.
   - Compose it in `apps/server/src/trpc/router.ts`.
   - Add agent env fields to `Env` and `TrpcEnv`.

## Web UI Plan

1. Add `apps/web/src/components/AgentChat.tsx`.
   - Chat transcript with user and assistant messages.
   - Input box with submit button.
   - Loading state while the mutation is running.
   - Inline tool activity summary after each assistant response.
   - Source links when search/reader tools were used.

2. Integrate into `apps/web/src/App.tsx`.
   - Keep the existing wind report as the primary screen.
   - Add a right-side or lower chat panel titled “Ask the wind agent”.
   - Seed the chat context with the selected zip code when present.
   - Suggested starter prompts can be buttons, for example:
     - “Will it be windy enough for outdoor work today?”
     - “Summarize the next 24 hours for this zip.”
     - “Check current alerts and explain the wind risk.”

3. Keep UI state local for v1.
   - No persisted chat history in D1 initially.
   - Add persistence later only if the user wants saved conversations.

## Testing Plan

- Contract tests for agent schemas.
- Unit tests for tool input validation and compact weather summaries.
- Adapter tests with mocked `fetch` for Google and Z.AI failures.
- Integration test for `agent.chat` with a fake model response that requests a weather tool.
- Web build/typecheck through `bun run build:web`.
- Full test run through `bun run test`.

## Rollout Plan

1. Land non-streaming chat with only first-party weather tools.
2. Add Z.AI MCP search and reader tools behind `AGENT_ENABLE_WEB_TOOLS`.
3. Add source rendering in the UI.
4. Add optional streaming once the basic tool loop is verified in Cloudflare Workers.
5. Add D1 conversation storage only after the chat behavior is stable.

## Main Risks

- Gemma 4 model ID and function-calling support must be verified against Google’s live model list before implementation.
- MCP client package compatibility with Cloudflare Workers must be tested early.
- Web search/reader outputs can be large; enforce truncation and source metadata.
- Tool use can leak secrets or internal details if prompts are loose; never expose env values, raw headers, or full internal errors to the model.
- Weather answers should distinguish forecast data from web-search context and should cite web sources when external tools are used.

## References

- Google GenAI SDK docs: https://ai.google.dev/gemini-api/docs/downloads
- Google function calling docs: https://ai.google.dev/gemini-api/docs/function-calling
- Google text generation docs: https://ai.google.dev/gemini-api/docs/text-generation
- Z.AI documentation index: https://docs.z.ai/llms.txt
- Z.AI Web Search MCP Server: https://docs.z.ai/devpack/mcp/search-mcp-server
- Z.AI Web Reader MCP Server: https://docs.z.ai/devpack/mcp/reader-mcp-server
- MCP TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk
