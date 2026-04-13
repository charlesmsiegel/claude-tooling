# Accessing Langfuse from Claude Code

## Strategy: MCP > Python SDK > cURL

For interacting with Langfuse data from within Claude Code, use this priority:

1. **MCP** — most context-efficient for interactive queries (traces, prompts, scores)
2. **Python SDK script** — best for evaluation pipelines and bulk operations
3. **cURL** — avoid; raw JSON wastes context window

## Community MCP Setup (10 minutes)

The community MCP (`avivsinai/langfuse-mcp`) provides a full observability toolkit — traces, observations, sessions, scores, datasets, prompts, and annotation queues. It runs locally via `uvx` and connects to your Langfuse instance.

### Step 1: Install uvx

```bash
pip install uv
```

### Step 2: Add the Community MCP

```bash
claude mcp add \
  -e LANGFUSE_PUBLIC_KEY=pk-lf-... \
  -e LANGFUSE_SECRET_KEY=sk-lf-... \
  -e LANGFUSE_HOST=http://localhost:3000 \
  --scope project \
  langfuse-traces -- uvx --python 3.11 langfuse-mcp
```

Point `LANGFUSE_HOST` at your self-hosted Langfuse instance.

### Step 3: Verify

Run `claude` and type `/mcp` to confirm the server appears and is connected.

**Checkpoint:** Ask Claude Code "list my recent traces" — if the MCP is working, it returns structured data.

## Python SDK for Evaluation Pipelines

When you need to pull traces in bulk, run LLM-as-judge evaluations, and push scores back, have Claude Code write and execute a Python script. This is vastly more context-efficient than cURL because the script can filter and aggregate before returning results.

### Install

```bash
pip install langfuse
```

### Core API Pattern

The `api` namespace is auto-generated from the Langfuse Public API OpenAPI spec. Method names mirror REST resources and support filters and pagination. In SDK v4+, `api.observations`, `api.scores`, and `api.metrics` are the defaults.

```python
from langfuse import get_client
langfuse = get_client()  # reads LANGFUSE_* env vars

# Pull traces with filters
traces = langfuse.api.trace.list(
    tags=["production"], limit=50,
    from_timestamp="2025-01-01T00:00:00Z"
).data

# Aggregate costs by model (Metrics API v2)
metrics = langfuse.api.metrics.get(query="""{
    "view": "observations",
    "metrics": [{"measure": "totalCost", "aggregation": "sum"}],
    "dimensions": [{"field": "providedModelName"}],
    "fromTimestamp": "2025-01-01T00:00:00Z",
    "toTimestamp": "2025-04-01T00:00:00Z"
}""")

# Push evaluation scores back
for trace in traces:
    langfuse.create_score(
        trace_id=trace.id,
        name="my_eval",
        value=0.87,
        data_type="NUMERIC"
    )
```

### Experiment Runner (Recommended for Evals)

The Experiment Runner keeps all scores in context and avoids the manual fetch-traces → fetch-scores → join pattern:

```python
from langfuse import get_client
langfuse = get_client()

def my_task(item):
    """Run your LLM pipeline on a single dataset item."""
    # your pipeline logic here
    return result

def my_evaluator(item, task_output):
    """Score a single result."""
    # your evaluation logic here
    return {"name": "accuracy", "value": 0.9, "data_type": "NUMERIC"}

result = langfuse.run_experiment(
    name="my-experiment",
    data=my_dataset,
    task=my_task,
    evaluators=[my_evaluator]
)
print(result.format())  # all scores included, no manual joining
```

This is vastly more context-efficient than fetching traces, fetching scores, and joining them manually.

## When to Use Which

| Task | Use |
|---|---|
| "List my recent traces" | MCP |
| "Get prompt X version 3" | MCP |
| "What's the cost breakdown by model?" | Python script with `api.metrics` |
| "Run faithfulness eval on last 50 traces" | Python script with Experiment Runner |
| "Add scores to traces" | Python script (bulk) or MCP (single) |
| "Check annotation queue status" | MCP |
| Quick one-off API check | cURL acceptable, but still prefer MCP |

## Why Not cURL

cURL is fine for one-off spot checks but terrible for anything Claude Code does repeatedly:

- Every response is raw JSON that burns context window
- No pagination handling — you manually manage offsets
- No type safety or auto-complete on field names
- The Metrics API v2 requires `--data-urlencode` with a JSON query parameter

When the Python SDK and MCP servers both exist, there is no reason to use cURL for Langfuse operations.
