# app/middleware/security_headers.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
            self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # --- ФИНАЛЬНЫЕ ИЗМЕНЕНИЯ ЗДЕСЬ ---
        # Эта политика должна работать и для Swagger UI, и для ReDoc
        csp_policy = [
            # 'self' - разрешает ресурсы с нашего домена
            "default-src 'self'",

            # Разрешаем стили с нашего домена, inline-стили (для MUI), шрифтов Google и CDN для Swagger
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",

            # Разрешаем скрипты:
            # 'self' - с нашего домена
            # https://cdn.jsdelivr.net - с CDN для ReDoc/Swagger
            # 'sha256-...' - хэш конкретного inline-скрипта, который использует FastAPI для Swagger. Это безопаснее, чем 'unsafe-inline'.
            "script-src 'self' https://cdn.jsdelivr.net 'sha256-eV3QMumkWxytVHa/LDvu+mnW+PcSAEI4SfFu0iIlbDc='",

            # Разрешаем картинки со своего домена, в формате data: и с сайта FastAPI (для favicon)
            "img-src 'self' data: https://fastapi.tiangolo.com",

            # Разрешаем шрифты со своего домена и с домена Google
            "font-src 'self' https://fonts.gstatic.com",

            # Разрешаем Web Workers, создаваемые из blob: URL (для поиска в Swagger)
            "worker-src blob:",

            # Остальные директивы оставляем строгими
            "connect-src 'self'",
            "frame-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        # --- КОНЕЦ ИЗМЕНЕНИЙ ---

        response.headers["Content-Security-Policy"] = "; ".join(csp_policy)

        return response