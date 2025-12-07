"""
Basic Usage Example

Run with: python examples/basic_usage.py
"""

import os
from infinity_assistant import InfinityAssistantClient

def main():
    # Initialize client
    client = InfinityAssistantClient(
        api_key=os.getenv("INFINITY_ASSISTANT_API_KEY", "ia_your_api_key_here")
    )

    try:
        # Health check
        print("Checking API health...")
        health = client.health()
        print("Health:", health)

        # Send a chat message
        print("\nSending chat message...")
        response = client.chat(
            message="Hello! Can you help me understand Python?",
            mode="assist"
        )

        print("Response:", response.get("response"))
        print("Conversation ID:", response.get("conversationId"))

        # Search knowledge base
        print("\nSearching knowledge base...")
        knowledge = client.search_knowledge(
            query="Python best practices",
            limit=5
        )

        print(f"Found {knowledge.get('total', 0)} results")
        for i, result in enumerate(knowledge.get("results", []), 1):
            print(f"{i}. {result.get('title', result.get('id'))}")
            content = result.get("content", "")
            print(f"   {content[:100]}...")

    except Exception as e:
        print(f"Error: {e}")
        if hasattr(e, "status_code"):
            print(f"Status Code: {e.status_code}")
        if hasattr(e, "code"):
            print(f"Error Code: {e.code}")

if __name__ == "__main__":
    main()

