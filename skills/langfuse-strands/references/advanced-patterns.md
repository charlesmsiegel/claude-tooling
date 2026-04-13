# Advanced Patterns

## Async Streaming

Use `stream_async` for real-time streaming with asyncio:

```python
import asyncio
from strands import Agent

async def stream_response(agent: Agent, query: str):
    async for event in agent.stream_async(query):
        if "data" in event:
            print(event["data"], end="", flush=True)
        elif "error" in event:
            print(f"Error: {event['error']}")

asyncio.run(stream_response(agent, "Tell me about AI agents"))
```

## Amazon Bedrock AgentCore Deployment

Deploy Strands agents to AgentCore Runtime with Langfuse tracing:

```python
from bedrock_agentcore.runtime import BedrockAgentCoreApp
from strands import Agent
from strands.models import BedrockModel
from strands.telemetry import StrandsTelemetry

app = BedrockAgentCoreApp()

@app.entrypoint
def agent_entrypoint(payload):
    # Initialize telemetry inside entrypoint
    StrandsTelemetry().setup_otlp_exporter()
    
    model = BedrockModel(
        model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
        region_name="us-west-2"
    )
    
    agent = Agent(
        model=model,
        system_prompt="Your agent system prompt",
        trace_attributes={
            "session.id": payload.get("session_id", "default"),
            "user.id": payload.get("user_id", "anonymous")
        }
    )
    
    return agent(payload["query"])

if __name__ == "__main__":
    app.run()
```

**AgentCore deployment notes:**
- Set `disable_otel=True` in AgentCore runtime config to use Langfuse instead of default observability
- Install: `pip install bedrock-agentcore-starter-toolkit strands-agents[otel] langfuse`

## Evaluation with Ragas

Combine Langfuse traces with Ragas metrics for systematic evaluation.

**Preferred: Use the Experiment Runner** which keeps all scores in context:

```python
from langfuse import get_client
from ragas.metrics import faithfulness, answer_relevancy

langfuse = get_client()

def ragas_evaluator(item, task_output):
    """Evaluate a single trace output with Ragas metrics."""
    from ragas import evaluate
    result = evaluate(
        dataset=[{
            "question": item["input"],
            "answer": task_output,
            "contexts": item.get("contexts", [])
        }],
        metrics=[faithfulness, answer_relevancy]
    )
    return [
        {"name": "faithfulness", "value": result.scores[0]["faithfulness"], "data_type": "NUMERIC"},
        {"name": "answer_relevancy", "value": result.scores[0]["answer_relevancy"], "data_type": "NUMERIC"},
    ]

result = langfuse.run_experiment(
    name="ragas-eval",
    data=my_dataset,
    task=my_task,
    evaluators=[ragas_evaluator]
)
print(result.format())
```

**Manual approach** (use when you need custom trace filtering):

```python
from langfuse import get_client
from ragas import evaluate
from ragas.metrics import faithfulness, answer_relevancy

langfuse = get_client()

# Fetch traces using the v4+ api namespace
traces = langfuse.api.trace.list(limit=100, tags=["production"]).data

# Extract data for Ragas evaluation
evaluation_data = []
for trace in traces:
    evaluation_data.append({
        "question": trace.input,
        "answer": trace.output,
        "contexts": extract_contexts(trace)  # Custom extraction logic
    })

# Run Ragas evaluation
results = evaluate(
    dataset=evaluation_data,
    metrics=[faithfulness, answer_relevancy]
)

# Push scores back to Langfuse
for trace, score in zip(traces, results.scores):
    langfuse.create_score(
        trace_id=trace.id,
        name="faithfulness",
        value=score["faithfulness"],
        data_type="NUMERIC"
    )
```

## Session Management for Stateful Agents

Use Strands SessionManager for persistent conversations:

```python
from strands import Agent
from strands.session import SessionManager, S3SessionStore

# Configure S3-backed session persistence
session_store = S3SessionStore(bucket="my-agent-sessions")
session_manager = SessionManager(store=session_store)

agent = Agent(
    model=model,
    system_prompt="Conversational assistant...",
    session_manager=session_manager,
    trace_attributes={"session.id": "persistent-session-123"}
)

# First turn
agent("My name is Alice")

# Later... session restored from S3
agent("What's my name?")  # Agent remembers "Alice"
```

## MCP Tool Integration

Use Model Context Protocol servers as tools:

```python
from strands import Agent
from strands.tools.mcp import MCPClient
from mcp.client.streamable_http import streamablehttp_client

# Connect to MCP server
mcp_client = MCPClient(
    lambda: streamablehttp_client("https://your-mcp-server.com/api")
)

agent = Agent(
    model=model,
    tools=[mcp_client],  # MCP tools auto-discovered
    trace_attributes={"langfuse.tags": ["mcp-enabled"]}
)
```

## Custom Callback Handler

Implement custom callbacks for fine-grained control:

```python
from strands import Agent
from strands.handlers import CallbackHandler

class LangfuseCallbackHandler(CallbackHandler):
    def on_tool_start(self, tool_name: str, tool_input: dict):
        # Custom logic before tool execution
        print(f"Starting tool: {tool_name}")
    
    def on_tool_end(self, tool_name: str, tool_output: str):
        # Custom logic after tool execution
        print(f"Tool {tool_name} completed")
    
    def on_llm_start(self, prompt: str):
        # Track LLM call start
        pass
    
    def on_llm_end(self, response: str):
        # Track LLM call end
        pass

agent = Agent(
    model=model,
    callback_handler=LangfuseCallbackHandler(),
    trace_attributes={"session.id": "..."}
)
```
