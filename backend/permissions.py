from rest_framework import permissions
from accounts.utils import user_has_perm


class IsOrgMember(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.organization)


class IsOwnerOrManager(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if getattr(user, 'role', '') in ['Admin', 'Manager']:
            return True
        owner = getattr(obj, 'owner', None)
        return owner == user


class HasAPIPermission(permissions.BasePermission):
    """
    Checks required_perm / permission_map on the view.
    permission_map can be a dict keyed by action name -> permission code.
    If no map entry is found:
      - SAFE_METHODS use required_perm
      - non-safe default to required_perm with '.edit' fallback (quotes.view -> quotes.edit)
    """

    required_perm = ''
    permission_map = {}

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'role', None) == 'Admin':
            return True

        action = getattr(view, 'action', None)
        perm_map = getattr(view, 'permission_map', {}) or self.permission_map
        perm = None
        if action and action in perm_map:
            perm = perm_map[action]
        else:
            base = getattr(view, 'required_perm', self.required_perm)
            if not base:
                return True
            if request.method in permissions.SAFE_METHODS:
                perm = base
            else:
                perm = base.replace('.view', '.edit')
        if not perm:
            return True
        return user_has_perm(user, perm)


class CommentOnlyRestriction(permissions.BasePermission):
    """
    If user's notification_prefs has comment_only=True:
      - Allow SAFE_METHODS
      - Allow POST on comment/message viewsets
      - Block other non-safe methods (create/update/delete on main resources)
    """

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        prefs = getattr(user, 'notification_prefs', {}) or {}
        if not prefs.get('comment_only'):
            return True
        if request.method in permissions.SAFE_METHODS:
            return True
        # allow posting comments/messages only
        view_name = view.__class__.__name__.lower()
        if request.method == 'POST' and any(
            key in view_name for key in ['commentviewset', 'ticketmessageviewset']
        ):
            return True
        return False


class ViewOnlyRestriction(permissions.BasePermission):
    """
    If user's notification_prefs has view_only=True: only SAFE_METHODS allowed.
    """

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        prefs = getattr(user, 'notification_prefs', {}) or {}
        if not prefs.get('view_only'):
            return True
        return request.method in permissions.SAFE_METHODS

