"""
Async Usage Example

Run with: python examples/async_example.py
"""

import os
import asyncio
from infinity_assistant import AsyncInfinityAssistantClient

async def main():
    # Use async context manager
    async with AsyncInfinityAssistantClient(
        api_key=os.getenv("INFINITY_ASSISTANT_API_KEY", "ia_your_api_key_here")
    ) as client:
        try:
            # Health check
            print("Checking API health...")
            health = await client.health()
            print("Health:", health)

            # Send a chat message
            print("\nSending chat message...")
            response = await client.chat(
                message="Hello! Can you help me?",
                mode="assist"
            )

            print("Response:", response.get("response"))

            # Streaming chat
            print("\nStreaming response...")
            async for chunk in client.chat_stream(message="Tell me a joke"):
                if chunk["type"] == "text":
                    print(chunk.get("content", ""), end="", flush=True)
                elif chunk["type"] == "done":
                    print("\n")
                    break

        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())

