from typing import Any

from app.tools.base import BaseTool


class WebSearchTool(BaseTool):
    """
    Safe mock web-search tool for AgentOS runtime testing.
    """

    name = "web_search"
    description = "Search the web for external information."

    async def execute(self, **kwargs: Any) -> Any:
        query = kwargs.get("query", "")

        return {
            "success": True,
            "source": "mock_web_search",
            "query": query,
            "results": [
                {
                    "title": "AgentOS Documentation",
                    "url": "https://example.com/agentos",
                    "snippet": f"Mock search result for: {query}",
                }
            ],
            "message": f"Web search completed for: {query}",
        }
