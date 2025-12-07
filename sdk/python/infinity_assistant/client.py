"""
Infinity Assistant SDK - Main Client
"""

import time
import json
from typing import Dict, List, Optional, Any, Iterator, AsyncIterator
from urllib.parse import urlencode

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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


class InfinityAssistantClient:
    """Main client for Infinity Assistant API"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://infinityassistant.io/api",
        timeout: int = 60,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ):
        """
        Initialize the Infinity Assistant client.

        Args:
            api_key: API key for authentication
            base_url: Base URL for the API (default: production)
            timeout: Request timeout in seconds (default: 60)
            max_retries: Maximum retry attempts (default: 3)
            retry_delay: Initial retry delay in seconds (default: 1.0)
        """
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay

        # Create session with retry strategy
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=retry_delay,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

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

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        retry_count: int = 0,
    ) -> Dict[str, Any]:
        """Make HTTP request with retry logic"""
        url = f"{self.base_url}{endpoint}"

        # Add query parameters
        if params:
            url += f"?{urlencode(params)}"

        try:
            response = self.session.request(
                method=method,
                url=url,
                headers=self._get_headers(),
                json=data,
                timeout=self.timeout,
            )

            # Handle rate limiting
            if response.status_code == 429:
                retry_after = response.headers.get("Retry-After")
                delay = int(retry_after) if retry_after else self.retry_delay

                if retry_count < self.max_retries:
                    time.sleep(delay)
                    return self._request(method, endpoint, params, data, retry_count + 1)

                raise InfinityAssistantRateLimitError(
                    "Rate limit exceeded. Please try again later."
                )

            # Handle errors
            if not response.ok:
                try:
                    error_data = response.json()
                except:
                    error_data = {"error": "Unknown error"}

                raise InfinityAssistantError(
                    error_data.get("message") or error_data.get("error") or "Request failed",
                    code=error_data.get("code"),
                    status_code=response.status_code,
                    response=error_data,
                )

            return response.json()

        except requests.exceptions.Timeout:
            raise InfinityAssistantTimeoutError("Request timeout")
        except requests.exceptions.RequestException as e:
            if retry_count < self.max_retries:
                time.sleep(self.retry_delay * (retry_count + 1))
                return self._request(method, endpoint, params, data, retry_count + 1)
            raise InfinityAssistantNetworkError(f"Network error: {str(e)}")

    def chat(self, **kwargs: Any) -> ChatResponse:
        """
        Send a chat message.

        Args:
            **kwargs: Chat request parameters (message, conversationId, mode, etc.)

        Returns:
            Chat response
        """
        return self._request("POST", "/chat", data=kwargs)

    def chat_stream(self, **kwargs: Any) -> Iterator[ChatStreamChunk]:
        """
        Send a chat message with streaming response.

        Args:
            **kwargs: Chat request parameters

        Yields:
            Chat stream chunks
        """
        url = f"{self.base_url}/chat"
        kwargs["stream"] = True

        try:
            response = self.session.post(
                url,
                headers=self._get_headers(),
                json=kwargs,
                timeout=self.timeout,
                stream=True,
            )

            if not response.ok:
                try:
                    error_data = response.json()
                except:
                    error_data = {"error": "Unknown error"}
                raise InfinityAssistantError(
                    error_data.get("message") or error_data.get("error") or "Request failed",
                    code=error_data.get("code"),
                    status_code=response.status_code,
                    response=error_data,
                )

            for line in response.iter_lines():
                if not line:
                    continue

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

        except requests.exceptions.Timeout:
            raise InfinityAssistantTimeoutError("Request timeout")
        except requests.exceptions.RequestException as e:
            raise InfinityAssistantNetworkError(f"Network error: {str(e)}")

    def search_knowledge(self, **kwargs: Any) -> KnowledgeSearchResponse:
        """Search knowledge base"""
        return self._request("POST", "/knowledge/search", data=kwargs)

    def store_memory(self, key: str, value: Any, ttl: Optional[int] = None) -> MemoryStoreResponse:
        """Store memory"""
        return self._request("POST", "/memory/store", data={"key": key, "value": value, "ttl": ttl})

    def retrieve_memory(self, key: str) -> MemoryRetrieveResponse:
        """Retrieve memory"""
        return self._request("GET", "/memory/retrieve", params={"key": key})

    def research(self, **kwargs: Any) -> ResearchResponse:
        """Perform web research"""
        return self._request("POST", "/research", data=kwargs)

    def list_api_keys(self) -> Dict[str, Any]:
        """List API keys"""
        return self._request("GET", "/api-keys")

    def create_api_key(self, name: str) -> Dict[str, Any]:
        """Create API key"""
        return self._request("POST", "/api-keys", data={"name": name})

    def delete_api_key(self, key_id: str) -> Dict[str, Any]:
        """Delete API key"""
        return self._request("DELETE", "/api-keys", params={"id": key_id})

    def list_webhooks(self) -> Dict[str, Any]:
        """List webhooks"""
        return self._request("GET", "/webhooks")

    def create_webhook(self, url: str, events: List[str]) -> Dict[str, Any]:
        """Create webhook"""
        return self._request("POST", "/webhooks", data={"url": url, "events": events})

    def delete_webhook(self, webhook_id: str) -> Dict[str, Any]:
        """Delete webhook"""
        return self._request("DELETE", "/webhooks", params={"id": webhook_id})

    def health(self) -> Dict[str, Any]:
        """Health check"""
        return self._request("GET", "/health")

