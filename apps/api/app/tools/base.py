from abc import ABC, abstractmethod
from typing import Any


class BaseTool(ABC):
    """
    Base interface for every AgentOS tool.
    """

    name: str
    description: str

    @abstractmethod
    async def execute(self, **kwargs: Any) -> Any:
        """
        Execute the tool.
        """
        raise NotImplementedError