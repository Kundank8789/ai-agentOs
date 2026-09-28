from typing import Any

from app.tools.base import BaseTool


class ReasoningTool(BaseTool):
    """
    Safe reasoning tool for AgentOS runtime testing.
    """

    name = "reasoning"
    description = "Analyze information and produce a structured reasoning result."

    async def execute(self, **kwargs: Any) -> Any:
        input_data = kwargs.get("input", kwargs.get("context", ""))

        return {
            "success": True,
            "source": "agentos_reasoning",
            "input": input_data,
            "analysis": "Reasoning completed successfully.",
            "message": "AgentOS reasoning step completed.",
        }
