---
name: langfuse-strands
description: Integrate Langfuse observability with AWS Strands Agents for comprehensive tracing, monitoring, and debugging of AI agent applications. Use when building Strands agents that need production observability, when debugging agent behavior, when tracking costs/latency/token usage, when setting up OpenTelemetry-based tracing for Strands, when querying Langfuse data from Claude Code, or when running evaluation pipelines against Langfuse traces.
---

# Langfuse + Strands Agents Observability

Integrate Langfuse's open-source LLM observability platform with AWS Strands Agents using OpenTelemetry.

## Core Integration Pattern

```python
import os
import base64
from strands import Agent
from strands.telemetry import StrandsTelemetry
from strands.models.bedrock import BedrockModel

# 1. Configure Langfuse credentials
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-lf-..."
os.environ["LANGFUSE_SECRET_KEY"] = "sk-lf-..."
os.environ["LANGFUSE_BASE_URL"] = "https://cloud.langfuse.com"  # EU default
# os.environ["LANGFUSE_BASE_URL"] = "https://us.cloud.langfuse.com"  # US region

# 2. Configure OTEL exporter for Langfuse
LANGFUSE_AUTH = base64.b64encode(
    f"{os.environ['LANGFUSE_PUBLIC_KEY']}:{os.environ['LANGFUSE_SECRET_KEY']}".encode()
).decode()
os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = f"{os.environ['LANGFUSE_BASE_URL']}/api/public/otel"
os.environ["OTEL_EXPORTER_OTLP_HEADERS"] = f"Authorization=Basic {LANGFUSE_AUTH}"

# 3. Initialize telemetry BEFORE creating agent
strands_telemetry = StrandsTelemetry().setup_otlp_exporter()

# 4. Create agent with trace attributes
agent = Agent(
    model=BedrockModel(model_id="us.anthropic.claude-sonnet-4-20250514-v1:0"),
    system_prompt="Your system prompt here",
    trace_attributes={
        "session.id": "unique-session-id",
        "user.id": "user@example.com",
        "langfuse.tags": ["production", "customer-support"]
    }
)

# 5. Run agent - traces automatically sent to Langfuse
result = agent("User query here")
```

## Installation

```bash
pip install strands-agents[otel] langfuse
# Optional: pip install strands-agents-tools for pre-built tools
```

## Key Configuration Reference

### Trace Attributes

Pass these in `trace_attributes` when creating an Agent:

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `session.id` | Group related conversations | `"chat-abc123"` |
| `user.id` | Track per-user metrics | `"user@domain.com"` |
| `langfuse.tags` | Filter/organize in UI | `["prod", "v2"]` |

### Model Providers

Strands supports multiple providers. Configure the model before passing to Agent:

```python
# Amazon Bedrock (default)
from strands.models.bedrock import BedrockModel
model = BedrockModel(model_id="us.anthropic.claude-sonnet-4-20250514-v1:0")

# Anthropic direct
from strands.models.anthropic import AnthropicModel
model = AnthropicModel(model_id="claude-sonnet-4-20250514")

# OpenAI
from strands.models.openai import OpenAIModel
model = OpenAIModel(model_id="gpt-4o")

# Ollama (local)
from strands.models.ollama import OllamaModel
model = OllamaModel(model_id="llama3")
```

## Common Patterns

### Adding Custom Tools

```python
from strands import Agent, tool

@tool
def search_database(query: str) -> str:
    """Search the customer database."""
    # Tool implementation
    return f"Results for: {query}"

agent = Agent(
    model=model,
    tools=[search_database],
    trace_attributes={"session.id": "..."}
)
```

### Combining with Langfuse SDK for Custom Spans

```python
from langfuse import observe, get_client

langfuse = get_client()

@observe()
def my_pipeline(user_input: str):
    # Pre-processing traced as custom span
    processed = preprocess(user_input)
    
    # Strands agent call - automatically traced
    result = agent(processed)
    
    # Post-processing traced as custom span
    return postprocess(result)
```

### Multi-Agent Orchestration

```python
from strands import Agent
from strands.multiagent import AgentTool

# Create specialized agents
researcher = Agent(model=model, system_prompt="Research specialist...")
writer = Agent(model=model, system_prompt="Writing specialist...")

# Orchestrator can delegate to sub-agents
orchestrator = Agent(
    model=model,
    system_prompt="Coordinate research and writing tasks...",
    tools=[
        AgentTool(researcher, name="researcher"),
        AgentTool(writer, name="writer")
    ],
    trace_attributes={"session.id": "multi-agent-session"}
)
```

## Langfuse Dashboard Features

After traces flow to Langfuse, use these features:

- **Trace View**: See full agent execution flow, tool calls, LLM generations
- **Cost Tracking**: Monitor token usage and costs per trace/session/user
- **Latency Analysis**: Identify slow operations via timeline view
- **Session Grouping**: View multi-turn conversations together
- **Filtering**: Use tags, user IDs, session IDs to filter traces
- **Evaluation**: Add scores to traces for quality monitoring

## Accessing Langfuse Data from Claude Code

When you need to query traces, manage prompts, or run evals from within Claude Code, use this priority order:

**MCP > Python SDK script > cURL** (in order of context efficiency)

### Langfuse MCP Setup

The community MCP (`avivsinai/langfuse-mcp`) provides a full observability toolkit — traces, observations, sessions, scores, datasets, prompts, and annotation queues. It runs locally via `uvx` and connects to your Langfuse instance (self-hosted or cloud):

```bash
# Install uvx if needed
pip install uv

# Add the community MCP
claude mcp add \
  -e LANGFUSE_PUBLIC_KEY=pk-lf-... \
  -e LANGFUSE_SECRET_KEY=sk-lf-... \
  -e LANGFUSE_HOST=http://localhost:3000 \
  --scope project \
  langfuse-traces -- uvx --python 3.11 langfuse-mcp
```

Verify: run `claude` → type `/mcp` to confirm the server is live.

**Checkpoint:** Ask Claude Code "list my recent traces" — if the MCP is working, it returns structured data.

### Python SDK for Evaluation Pipelines

When you need to pull traces in bulk, run LLM-as-judge, and push scores back, write a Python script. The `api` namespace mirrors the REST API with filters and pagination:

```python
from langfuse import get_client
langfuse = get_client()  # reads LANGFUSE_* env vars

# Pull traces
traces = langfuse.api.trace.list(
    tags=["production"], limit=50,
    from_timestamp="2025-01-01T00:00:00Z"
).data

# Aggregate costs by model
metrics = langfuse.api.metrics.get(query="""{
    "view": "observations",
    "metrics": [{"measure": "totalCost", "aggregation": "sum"}],
    "dimensions": [{"field": "providedModelName"}],
    "fromTimestamp": "2025-01-01T00:00:00Z",
    "toTimestamp": "2025-04-01T00:00:00Z"
}""")

# Push evaluation scores back
langfuse.create_score(
    trace_id=trace.id,
    name="my_eval",
    value=0.87,
    data_type="NUMERIC"
)
```

For structured experiments, use the Experiment Runner which keeps all scores in context:

```python
result = langfuse.run_experiment(
    name="my-experiment",
    data=my_dataset,
    task=my_task,
    evaluators=[my_evaluator]
)
print(result.format())  # all scores included
```

### Why Not cURL

Avoid cURL for Langfuse operations in Claude Code. Every response is raw JSON that burns context window. The MCP servers return structured tool results, and Python scripts can filter/aggregate before returning. cURL is acceptable only for one-off spot checks.

See `references/claude-code-integration.md` for the full setup guide, evaluation pipeline patterns, and a decision table for when to use MCP vs. Python SDK.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No traces appearing | Verify OTEL environment variables are set before `StrandsTelemetry()` call |
| Auth errors | Check public/secret key pair matches Langfuse project |
| Missing tool spans | Ensure tools use `@tool` decorator from strands |
| Bedrock access denied | Enable model access in AWS Bedrock console |

## Additional Resources

- See `references/claude-code-integration.md` for MCP setup, Python SDK eval patterns, and when to use which approach
- See `references/advanced-patterns.md` for async patterns, AgentCore deployment, and evaluation with Ragas
- See `references/environment-setup.md` for complete environment variable reference
