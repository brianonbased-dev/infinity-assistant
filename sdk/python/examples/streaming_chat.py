"""
Streaming Chat Example

Run with: python examples/streaming_chat.py
"""

import os
import sys
from infinity_assistant import InfinityAssistantClient

def main():
    client = InfinityAssistantClient(
        api_key=os.getenv("INFINITY_ASSISTANT_API_KEY", "ia_your_api_key_here")
    )

    try:
        print("Starting streaming chat...\n")

        full_response = ""

        for chunk in client.chat_stream(
            message="Write a short story about a robot learning to paint",
            mode="assist"
        ):
            if chunk["type"] == "text":
                content = chunk.get("content", "")
                sys.stdout.write(content)
                sys.stdout.flush()
                full_response += content
            elif chunk["type"] == "metadata":
                print("\n\n[Metadata]", chunk.get("metadata"))
            elif chunk["type"] == "done":
                print("\n\n[Stream complete]")
                break
            elif chunk["type"] == "error":
                print("\n\n[Error]", chunk.get("error"))
                break

        print("\n\nFull response length:", len(full_response))

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()

