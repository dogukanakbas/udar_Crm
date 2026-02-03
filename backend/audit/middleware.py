from django.utils.deprecation import MiddlewareMixin
from django.urls import resolve

from .models import AccessLog


class AccessLogMiddleware(MiddlewareMixin):
    def process_view(self, request, view_func, view_args, view_kwargs):
        try:
            if not request.user.is_authenticated:
                return
            # only api paths
            if not request.path.startswith('/api/'):
                return
            if request.path.startswith('/api/access-logs'):
                return
            org = getattr(request.user, 'organization', None)
            if not org:
                return
            AccessLog.objects.create(
                organization=org,
                user=request.user,
                path=request.path,
                method=request.method,
                ip=request.META.get('REMOTE_ADDR'),
                meta={},
            )
        except Exception:
            # fail silent
            return

