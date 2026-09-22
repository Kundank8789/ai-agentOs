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
) -> ExecutionPlan:

    prompt = f"""
Create an execution plan for this AgentOS business task.

Task title:
{task_title}

Task description:
{task_description or "No additional description."}

Available tools:
- google_sheets
- gmail
- crm
- web_search
- reasoning
- approval

Rules:
- Only use tools from the available tools list.
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
