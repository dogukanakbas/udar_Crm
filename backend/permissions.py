from rest_framework import permissions
from accounts.utils import user_has_perm


class IsOrgMember(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.organization)


class IsOwnerOrManager(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if getattr(user, 'is_superadmin', False) or getattr(user, 'is_superuser', False):
            return True
        if request.method in permissions.SAFE_METHODS and user_has_perm(user, 'quotes.view.all'):
            return True
        if request.method not in permissions.SAFE_METHODS and user_has_perm(user, 'quotes.edit.all'):
            return True
        owner = getattr(obj, 'owner', None)
        return owner == user


class HasAPIPermission(permissions.BasePermission):
    """
    Checks required_perm / permission_map on the view.
    permission_map can be a dict keyed by action name -> permission code.
    If no map entry is found:
      - SAFE_METHODS use required_perm
      - non-safe methods use write_perm/default_write_perm when defined
      - otherwise common write/manage variants are tried before falling back to required_perm
    """

    required_perm = ''
    permission_map = {}

    def _candidate_write_perms(self, view, base):
        explicit = (
            getattr(view, 'write_perm', None)
            or getattr(view, 'default_write_perm', None)
            or getattr(view, 'required_write_perm', None)
        )
        if explicit:
            return [explicit] if isinstance(explicit, str) else list(explicit)
        if not base:
            return []
        candidates = []
        if base.endswith('.view'):
            root = base[:-5]
            candidates.extend([f'{root}.manage', f'{root}.edit', f'{root}.operate'])
        candidates.append(base)
        return list(dict.fromkeys(candidates))

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        action = getattr(view, 'action', None)
        perm_map = getattr(view, 'permission_map', {}) or self.permission_map
        if action and action in perm_map:
            perm = perm_map[action]
            if not perm:
                return True
            if isinstance(perm, (list, tuple, set)):
                return any(user_has_perm(user, code) for code in perm)
            return user_has_perm(user, perm)

        base = getattr(view, 'required_perm', self.required_perm)
        if not base:
            return True
        if request.method in permissions.SAFE_METHODS:
            return user_has_perm(user, base)
        return any(user_has_perm(user, code) for code in self._candidate_write_perms(view, base))


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
