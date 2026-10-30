from openai import AsyncOpenAI

from app.config import settings
from app.schemas.plan import ExecutionPlan


client = AsyncOpenAI(
    api_key=settings.groq_api_key,
    base_url="https://api.groq.com/openai/v1",
)


async def generate_plan(
    task_title: str,
    task_description: str | None,
    memory_context: list[dict] | None = None,
    agent_instructions: str | None = None,
    available_tools: list[str] | None = None,
) -> ExecutionPlan:

    # -----------------------------------------
    # Format memories for the prompt
    # -----------------------------------------
    memory_context = memory_context or []

    memory_text = "\n".join(
        f"- {memory['key']}: {memory['value']}"
        for memory in memory_context
    )

    if memory_text:
        memory_section = (
            "\nRelevant memories from past tasks:\n"
            f"{memory_text}\n"
        )
    else:
        memory_section = ""

    # -----------------------------------------
    # Format available tools for the prompt
    # -----------------------------------------
    available_tools = available_tools or []

    tools_text = "\n".join(
        f"- {tool}" for tool in available_tools
    ) or "- No tools available"

    prompt = f"""
Create an execution plan for this AgentOS business task.

Agent instructions:
{agent_instructions or "Follow general business safety and accuracy rules."}

Task title:
{task_title}

Task description:
{task_description or "No additional description."}
{memory_section}
Available tools:
{tools_text}

Rules:
- Only use tools from the available tools list.
- Never request a tool that is not enabled for this agent.
- Every plan step MUST specify exactly one tool.
- The tool field MUST never be null.
- Do not execute anything while planning.
- Reading data from Google Sheets does not require approval.
- Identifying or filtering customers does not require approval.
- Drafting an email does not require approval.
- Sending an email requires approval.
- Updating CRM records requires approval.
- Any external side effect requires approval.
- Keep the plan practical and concise.
- Do not create duplicate steps for the same action.
- If an email needs to be sent, create a separate drafting step followed by a sending step.
- The sending step must have requires_approval=true.
- Use memories above to inform decisions when relevant.
"""

    response = await client.responses.create(
        model=settings.groq_model,
        instructions=(
            "You are the AgentOS planning engine. "
            "Return a structured execution plan."
        ),
        input=prompt,
        text={
            "format": {
                "type": "json_schema",
                "name": "execution_plan",
                "schema": ExecutionPlan.model_json_schema(),
                "strict": True,
            }
        },
    )

    return ExecutionPlan.model_validate_json(response.output_text)