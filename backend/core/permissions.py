from rest_framework import permissions


class IsSuperAdmin(permissions.BasePermission):
    """
    Permission check for platform superadmin.
    Only users with is_superadmin=True can access.
    """
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_superadmin', False)
        )


class IsSuperAdminOrReadOnly(permissions.BasePermission):
    """
    Superadmin can do anything, others can only read.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'is_superadmin', False)
        )
