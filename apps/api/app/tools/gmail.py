from typing import Any

from app.tools.base import BaseTool


class GmailTool(BaseTool):
    name = "gmail"

    description = "Draft or send emails to customers."

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        customers = kwargs.get("customers", [])
        mode = kwargs.get("mode", "send")

        if mode == "draft":
            return {
                "success": True,
                "source": "mock_gmail",
                "mode": "draft",
                "customers_count": len(customers),
                "customers": customers,
                "message": f"Email drafts prepared for {len(customers)} customers.",
            }

        if mode == "send":
            return {
                "success": True,
                "source": "mock_gmail",
                "mode": "send",
                "customers_count": len(customers),
                "customers": customers,
                "message": f"Emails sent successfully to {len(customers)} customers.",
            }

        return {
            "success": False,
            "source": "mock_gmail",
            "mode": mode,
            "message": f"Unsupported Gmail mode: {mode}",
        }
