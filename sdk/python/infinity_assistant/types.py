"""
Infinity Assistant SDK - Type Definitions
"""

from typing import Dict, List, Optional, Any, Literal, Union
from typing_extensions import TypedDict


class ChatRequest(TypedDict, total=False):
    """Chat request parameters"""
    message: str
    conversationId: Optional[str]
    userId: Optional[str]
    userTier: Optional[Literal["free", "pro", "enterprise"]]
    mode: Optional[Literal["search", "assist", "build"]]
    userContext: Optional[str]
    preferences: Optional[Dict[str, Any]]
    essence: Optional[Dict[str, Any]]
    sessionId: Optional[str]
    drivingMode: Optional[bool]


class ChatResponse(TypedDict, total=False):
    """Chat response"""
    success: bool
    response: Optional[str]
    conversationId: Optional[str]
    messageId: Optional[str]
    metadata: Optional[Dict[str, Any]]
    error: Optional[str]


class ChatStreamChunk(TypedDict, total=False):
    """Chat streaming chunk"""
    type: Literal["text", "metadata", "done", "error"]
    content: Optional[str]
    metadata: Optional[Dict[str, Any]]
    error: Optional[str]


class KnowledgeSearchRequest(TypedDict, total=False):
    """Knowledge search request"""
    query: str
    limit: Optional[int]
    filters: Optional[Dict[str, Any]]


class KnowledgeSearchResponse(TypedDict, total=False):
    """Knowledge search response"""
    success: bool
    results: Optional[List[Dict[str, Any]]]
    total: Optional[int]
    error: Optional[str]


class MemoryStoreRequest(TypedDict):
    """Memory store request"""
    key: str
    value: Any
    ttl: Optional[int]


class MemoryStoreResponse(TypedDict, total=False):
    """Memory store response"""
    success: bool
    stored: Optional[bool]
    error: Optional[str]


class MemoryRetrieveRequest(TypedDict):
    """Memory retrieve request"""
    key: str


class MemoryRetrieveResponse(TypedDict, total=False):
    """Memory retrieve response"""
    success: bool
    value: Optional[Any]
    found: Optional[bool]
    error: Optional[str]


class ResearchRequest(TypedDict, total=False):
    """Research request"""
    query: str
    depth: Optional[Literal["shallow", "medium", "deep"]]
    sources: Optional[int]


class ResearchResponse(TypedDict, total=False):
    """Research response"""
    success: bool
    results: Optional[List[Dict[str, Any]]]
    summary: Optional[str]
    error: Optional[str]


class ApiKey(TypedDict, total=False):
    """API key information"""
    id: str
    name: str
    prefix: str
    createdAt: str
    lastUsed: Optional[str]
    isActive: bool


class Webhook(TypedDict, total=False):
    """Webhook information"""
    id: str
    url: str
    events: List[str]
    isActive: bool
    createdAt: str
    lastTriggered: Optional[str]
    failureCount: int

