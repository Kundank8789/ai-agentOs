from typing import Any

from app.tools.base import BaseTool


class ToolRegistry:
    """
    Central registry for AgentOS tools.
    """

    def __init__(self) -> None:
        self._tools: dict[str, BaseTool] = {}

    def register(self, tool: BaseTool) -> None:
        if tool.name in self._tools:
            raise ValueError(
                f"Tool '{tool.name}' is already registered."
            )

        self._tools[tool.name] = tool

    def get(self, name: str) -> BaseTool:
        tool = self._tools.get(name)

        if tool is None:
            raise KeyError(
                f"Tool '{name}' is not registered."
            )

        return tool

    def list_tools(self) -> list[str]:
        return list(self._tools.keys())

    async def execute(
        self,
        name: str,
        **kwargs: Any,
    ) -> Any:
        tool = self.get(name)

        return await tool.execute(**kwargs)