import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.db.models import RequestMetric
from app.db.session import SessionLocal


class RequestMetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        # Ignore static files or favicon requests if any
        path = request.url.path
        if path.startswith("/static") or path == "/favicon.ico":
            return await call_next(request)

        start_time = time.perf_counter()
        status_code = 500
        try:
            response = await call_next(request)
            status_code = response.status_code
            return response
        except Exception:
            status_code = 500
            raise
        finally:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            # Log metric safely into SQLite DB without breaking response
            try:
                db = SessionLocal()
                try:
                    metric = RequestMetric(
                        endpoint=path,
                        method=request.method,
                        status_code=status_code,
                        response_time_ms=duration_ms,
                    )
                    db.add(metric)
                    db.commit()
                finally:
                    db.close()
            except Exception:
                pass
