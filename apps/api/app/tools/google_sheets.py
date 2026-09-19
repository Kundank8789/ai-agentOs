from typing import Any

from app.tools.base import BaseTool


class GoogleSheetsTool(BaseTool):
    name = "google_sheets"
    description = (
        "Read order and business data from Google Sheets."
    )

    async def execute(self, **kwargs: Any) -> dict[str, Any]:
        """
        Temporary mock implementation.

        Later this will use the Google Sheets API.
        """

        return {
            "success": True,
            "source": "mock_google_sheets",
            "orders": [
                {
                    "order_id": "ORD-1001",
                    "customer_name": "Rahul",
                    "customer_email": "rahul@example.com",
                    "status": "Delayed",
                    "expected_date": "2026-09-19",
                },
                {
                    "order_id": "ORD-1002",
                    "customer_name": "Priya",
                    "customer_email": "priya@example.com",
                    "status": "Delivered",
                    "expected_date": "2026-09-18",
                },
                {
                    "order_id": "ORD-1003",
                    "customer_name": "Amit",
                    "customer_email": "amit@example.com",
                    "status": "Delayed",
                    "expected_date": "2026-09-19",
                },
            ],
        }