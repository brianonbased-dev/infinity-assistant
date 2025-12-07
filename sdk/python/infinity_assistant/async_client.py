"""
Infinity Assistant SDK - Async Client
"""

import asyncio
import json
from typing import Dict, List, Optional, Any, AsyncIterator

import aiohttp

from .exceptions import (
    InfinityAssistantError,
    InfinityAssistantRateLimitError,
    InfinityAssistantTimeoutError,
    InfinityAssistantNetworkError,
)
from .types import (
    ChatRequest,
    ChatResponse,
    ChatStreamChunk,
    KnowledgeSearchRequest,
    KnowledgeSearchResponse,
    MemoryStoreRequest,
    MemoryStoreResponse,
    MemoryRetrieveRequest,
    MemoryRetrieveResponse,
    ResearchRequest,
    ResearchResponse,
)


class AsyncInfinityAssistantClient:
    """Async client for Infinity Assistant API"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://infinityassistant.io/api",
        timeout: int = 60,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        """
        Initialize the async Infinity Assistant client.

        Args:
            api_key: API key for authentication
            base_url: Base URL for the API (default: production)
            timeout: Request timeout in seconds (default: 60)
            max_retries: Maximum retry attempts (default: 3)
            retry_delay: Initial retry delay in seconds (default: 1.0)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = aiohttp.ClientTimeout(total=timeout)
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self._session: Optional[aiohttp.ClientSession] = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=self.timeout)
        return self._session

    async def close(self) -> None:
        """Close the session"""
        if self._session and not self._session.closed:
            await self._session.close()

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()

    def set_api_key(self, api_key: str) -> None:
        """Set API key"""
        self.api_key = api_key

    def get_api_key(self) -> Optional[str]:
        """Get current API key"""
        return self.api_key

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers"""
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        retry_count: int = 0,
    ) -> Dict[str, Any]:
        """Make async HTTP request with retry logic"""
        url = f"{self.base_url}{endpoint}"

        session = await self._get_session()

        try:
            async with session.request(
                method=method,
                url=url,
                headers=self._get_headers(),
                params=params,
                json=data,
            ) as response:
                # Handle rate limiting
                if response.status == 429:
                    retry_after = response.headers.get("Retry-After")
                    delay = int(retry_after) if retry_after else self.retry_delay

                    if retry_count < self.max_retries:
                        await asyncio.sleep(delay)
                        return await self._request(method, endpoint, params, data, retry_count + 1)

                    raise InfinityAssistantRateLimitError(
                        "Rate limit exceeded. Please try again later."
                    )

                # Handle errors
                if not response.ok:
                    try:
                        error_data = await response.json()
                    except:
                        error_data = {"error": "Unknown error"}

                    raise InfinityAssistantError(
                        error_data.get("message") or error_data.get("error") or "Request failed",
                        code=error_data.get("code"),
                        status_code=response.status,
                        response=error_data,
                    )

                return await response.json()

        except asyncio.TimeoutError:
            raise InfinityAssistantTimeoutError("Request timeout")
        except aiohttp.ClientError as e:
            if retry_count < self.max_retries:
                await asyncio.sleep(self.retry_delay * (retry_count + 1))
                return await self._request(method, endpoint, params, data, retry_count + 1)
            raise InfinityAssistantNetworkError(f"Network error: {str(e)}")

    async def chat(self, **kwargs: Any) -> ChatResponse:
        """Send a chat message"""
        return await self._request("POST", "/chat", data=kwargs)

    async def chat_stream(self, **kwargs: Any) -> AsyncIterator[ChatStreamChunk]:
        """Send a chat message with streaming response"""
        url = f"{self.base_url}/chat"
        kwargs["stream"] = True

        session = await self._get_session()

        try:
            async with session.post(
                url,
                headers=self._get_headers(),
                json=kwargs,
            ) as response:
                if not response.ok:
                    try:
                        error_data = await response.json()
                    except:
                        error_data = {"error": "Unknown error"}
                    raise InfinityAssistantError(
                        error_data.get("message") or error_data.get("error") or "Request failed",
                        code=error_data.get("code"),
                        status_code=response.status,
                        response=error_data,
                    )

                async for line in response.content:
                    line_str = line.decode("utf-8")
                    if line_str.startswith("data: "):
                        data = line_str[6:]

                        if data == "[DONE]":
                            yield {"type": "done"}
                            break

                        try:
                            parsed = json.loads(data)

                            if parsed.get("type") == "error":
                                yield {"type": "error", "error": parsed.get("error", "Unknown error")}
                                break

                            if parsed.get("content"):
                                yield {"type": "text", "content": parsed["content"]}

                            if parsed.get("metadata"):
                                yield {"type": "metadata", "metadata": parsed["metadata"]}

                        except json.JSONDecodeError:
                            continue

                yield {"type": "done"}

        except asyncio.TimeoutError:
            raise InfinityAssistantTimeoutError("Request timeout")
        except aiohttp.ClientError as e:
            raise InfinityAssistantNetworkError(f"Network error: {str(e)}")

    async def search_knowledge(self, **kwargs: Any) -> KnowledgeSearchResponse:
        """Search knowledge base"""
        return await self._request("POST", "/knowledge/search", data=kwargs)

    async def store_memory(self, key: str, value: Any, ttl: Optional[int] = None) -> MemoryStoreResponse:
        """Store memory"""
        return await self._request("POST", "/memory/store", data={"key": key, "value": value, "ttl": ttl})

    async def retrieve_memory(self, key: str) -> MemoryRetrieveResponse:
        """Retrieve memory"""
        return await self._request("GET", "/memory/retrieve", params={"key": key})

    async def research(self, **kwargs: Any) -> ResearchResponse:
        """Perform web research"""
        return await self._request("POST", "/research", data=kwargs)

    async def list_api_keys(self) -> Dict[str, Any]:
        """List API keys"""
        return await self._request("GET", "/api-keys")

    async def create_api_key(self, name: str) -> Dict[str, Any]:
        """Create API key"""
        return await self._request("POST", "/api-keys", data={"name": name})

    async def delete_api_key(self, key_id: str) -> Dict[str, Any]:
        """Delete API key"""
        return await self._request("DELETE", "/api-keys", params={"id": key_id})

    async def list_webhooks(self) -> Dict[str, Any]:
        """List webhooks"""
        return await self._request("GET", "/webhooks")

    async def create_webhook(self, url: str, events: List[str]) -> Dict[str, Any]:
        """Create webhook"""
        return await self._request("POST", "/webhooks", data={"url": url, "events": events})

    async def delete_webhook(self, webhook_id: str) -> Dict[str, Any]:
        """Delete webhook"""
        return await self._request("DELETE", "/webhooks", params={"id": webhook_id})

    async def health(self) -> Dict[str, Any]:
        """Health check"""
        return await self._request("GET", "/health")

