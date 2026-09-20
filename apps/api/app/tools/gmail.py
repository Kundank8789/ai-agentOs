from typing import Any

from app.tools.base import BaseTool


class GmailTool(BaseTool):
    name = "gmail"

    description = "Send emails to customers."

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        customers = kwargs.get("customers", [])

        return {
            "success": True,
            "source": "mock_gmail",
            "customers_count": len(customers),
            "customers": customers,
            "message": f"Emails sent successfully to {len(customers)} customers.",
        }