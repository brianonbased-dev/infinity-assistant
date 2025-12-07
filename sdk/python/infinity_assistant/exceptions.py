"""
Infinity Assistant SDK - Exception Classes
"""


class InfinityAssistantError(Exception):
    """Base exception for all Infinity Assistant API errors"""

    def __init__(
        self,
        message: str,
        code: str = None,
        status_code: int = None,
        response: dict = None,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
        self.response = response

    def __str__(self):
        if self.code:
            return f"{self.code}: {self.message}"
        return self.message


class InfinityAssistantRateLimitError(InfinityAssistantError):
    """Raised when rate limit is exceeded"""

    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, code="RATE_LIMIT", status_code=429)


class InfinityAssistantTimeoutError(InfinityAssistantError):
    """Raised when request times out"""

    def __init__(self, message: str = "Request timeout"):
        super().__init__(message, code="TIMEOUT", status_code=408)


class InfinityAssistantNetworkError(InfinityAssistantError):
    """Raised on network errors"""

    def __init__(self, message: str = "Network error"):
        super().__init__(message, code="NETWORK_ERROR", status_code=0)

