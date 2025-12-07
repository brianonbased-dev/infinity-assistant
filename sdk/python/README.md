# Infinity Assistant Python SDK

Official Python SDK for the Infinity Assistant API.

## Installation

```bash
pip install infinity-assistant
```

Or from source:

```bash
pip install .
```

## Quick Start

```python
from infinity_assistant import InfinityAssistantClient

# Initialize client
client = InfinityAssistantClient(
    api_key="ia_your_api_key_here",
    base_url="https://infinityassistant.io/api"  # optional, defaults to production
)

# Send a chat message
response = client.chat(
    message="Hello! How can you help me?",
    mode="assist"
)

print(response["response"])
```

## Authentication

### API Key Authentication (Recommended)

```python
client = InfinityAssistantClient(api_key="ia_your_api_key_here")
```

Get your API key from the [Infinity Assistant Dashboard](https://infinityassistant.io/dashboard).

### Setting API Key After Initialization

```python
client = InfinityAssistantClient()
client.set_api_key("ia_your_api_key_here")
```

## Features

### Chat

#### Basic Chat

```python
response = client.chat(
    message="What is the capital of France?",
)

print(response["response"])
```

#### Chat with Context

```python
response = client.chat(
    message="What did we discuss earlier?",
    conversation_id="conv_1234567890",
    mode="assist",
    preferences={
        "assistantMode": "professional"
    }
)
```

#### Streaming Chat

```python
for chunk in client.chat_stream(
    message="Tell me a story",
):
    if chunk["type"] == "text":
        print(chunk["content"], end="", flush=True)
    elif chunk["type"] == "metadata":
        print("\nMetadata:", chunk["metadata"])
    elif chunk["type"] == "done":
        print("\nDone!")
        break
    elif chunk["type"] == "error":
        print("\nError:", chunk["error"])
        break
```

### Knowledge Base

```python
# Search knowledge base
results = client.search_knowledge(
    query="best practices for Python",
    limit=10,
    filters={
        "type": "wisdom",
        "tags": ["python", "programming"]
    }
)

print(f"Found {results['total']} results")
for result in results["results"]:
    print(f"- {result['title']}: {result['content']}")
```

### Memory

```python
# Store memory
client.store_memory(
    key="user_preference",
    value={"theme": "dark", "language": "en"},
    ttl=3600  # 1 hour
)

# Retrieve memory
memory = client.retrieve_memory(key="user_preference")

if memory["found"]:
    print("Preference:", memory["value"])
```

### Research

```python
research = client.research(
    query="latest developments in AI",
    depth="deep",
    sources=5
)

print("Summary:", research["summary"])
for result in research["results"]:
    print(f"- {result['title']}: {result['url']}")
```

### API Key Management

```python
# List API keys
api_keys = client.list_api_keys()
print("API Keys:", api_keys["apiKeys"])

# Create new API key
new_key = client.create_api_key(name="My App")
print("New API Key:", new_key["apiKey"]["key"])  # Save this - shown only once!

# Delete API key
client.delete_api_key(key_id=new_key["apiKey"]["id"])
```

### Webhooks

```python
# List webhooks
webhooks = client.list_webhooks()
print("Webhooks:", webhooks["webhooks"])

# Create webhook
webhook = client.create_webhook(
    url="https://your-app.com/webhooks",
    events=["chat.message", "chat.response"]
)
print("Webhook Secret:", webhook["webhook"]["secret"])  # Save this!

# Delete webhook
client.delete_webhook(webhook_id=webhook["webhook"]["id"])
```

## Error Handling

The SDK provides custom exception classes for better error handling:

```python
from infinity_assistant import (
    InfinityAssistantError,
    InfinityAssistantRateLimitError,
    InfinityAssistantTimeoutError,
)

try:
    response = client.chat(message="Hello")
except InfinityAssistantRateLimitError as e:
    print("Rate limit exceeded. Please wait.")
except InfinityAssistantTimeoutError as e:
    print("Request timeout. Please try again.")
except InfinityAssistantError as e:
    print(f"API Error: {e.message}")
    print(f"Status Code: {e.status_code}")
    print(f"Error Code: {e.code}")
except Exception as e:
    print(f"Unknown error: {e}")
```

## Configuration

```python
client = InfinityAssistantClient(
    api_key="ia_your_api_key_here",
    base_url="https://infinityassistant.io/api",  # optional
    timeout=60,  # seconds, optional
    max_retries=3,  # optional
    retry_delay=1.0,  # seconds, optional
)
```

## Retry Logic

The SDK automatically retries failed requests with exponential backoff:
- Network errors: Retries up to `max_retries` times
- Rate limit errors: Respects `Retry-After` header
- Timeout errors: Retries with exponential backoff

## Async Support

The SDK also supports async/await:

```python
import asyncio
from infinity_assistant import AsyncInfinityAssistantClient

async def main():
    client = AsyncInfinityAssistantClient(api_key="ia_your_api_key_here")
    
    response = await client.chat(message="Hello!")
    print(response["response"])

asyncio.run(main())
```

## Type Hints

Full type hint support included:

```python
from infinity_assistant import InfinityAssistantClient
from infinity_assistant.types import ChatRequest, ChatResponse

def send_message(client: InfinityAssistantClient, request: ChatRequest) -> ChatResponse:
    return client.chat(**request)
```

## Examples

See the [examples directory](./examples) for more usage examples.

## API Reference

Full API reference available at [https://infinityassistant.io/docs](https://infinityassistant.io/docs).

## Support

- Documentation: [https://infinityassistant.io/docs](https://infinityassistant.io/docs)
- Issues: [GitHub Issues](https://github.com/infinityassistant/infinityassistant-service/issues)
- Support: [support@infinityassistant.io](mailto:support@infinityassistant.io)

## License

MIT

