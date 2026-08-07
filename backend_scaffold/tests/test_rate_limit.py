from app.core.rate_limit import get_rate_limit_key


class DummyRequest:
    def __init__(self, headers: dict, client_host: str = "127.0.0.1"):
        self.headers = headers
        self.client = type("Client", (), {"host": client_host})()


def test_get_rate_limit_key_with_api_key():
    req = DummyRequest(headers={"X-API-Key": "test-secret-key"})
    key = get_rate_limit_key(req)
    assert key == "key:test-secret-key"


def test_get_rate_limit_key_fallback_ip():
    req = DummyRequest(headers={})
    key = get_rate_limit_key(req)
    assert key == "127.0.0.1"
