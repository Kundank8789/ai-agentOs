from openai import AsyncOpenAI

from app.config import settings


client = AsyncOpenAI(
    api_key=settings.groq_api_key,
    base_url="https://api.groq.com/openai/v1",
)


async def generate_plan(
    task_title: str,
    task_description: str | None,
):
    prompt = f"""
You are the planning engine for AgentOS.

Analyze the following business task and create a concise execution plan.

Task title:
{task_title}

Task description:
{task_description or "No additional description."}

Return:

1. Goal
2. Required steps
3. Tools that may be required
4. Whether human approval may be required

Do not execute anything.
Only create the plan.
"""

    response = await client.responses.create(
        model=settings.groq_model,
        instructions=(
            "You are an AI operations planner. "
            "Be precise, practical, and concise."
        ),
        input=prompt,
    )

    return response.output_text