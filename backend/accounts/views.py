from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string
from rest_framework import viewsets, permissions, filters
from permissions import IsOrgMember, HasAPIPermission
from .models import Team
from .serializers import TeamSerializer


class MeView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    user = request.user
    # Eğer organization atanmadıysa, mevcut org'a otomatik bağla (demo/dev kolaylığı)
    if not getattr(user, "organization", None):
      from organizations.models import Organization
      org = Organization.objects.first()
      if org:
        user.organization = org
        user.save(update_fields=["organization"])
    return Response(
      {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": getattr(user, "role", None),
        "organization": user.organization.id if user.organization else None,
      }
    )


class UsersListView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    User = get_user_model()
    qs = User.objects.all()
    org = getattr(request.user, "organization", None)
    if org:
      qs = qs.filter(organization=org)
    data = [{"id": u.id, "username": u.username, "email": u.email, "role": u.role} for u in qs]
    return Response(data)


class CreateUserView(APIView):
  permission_classes = [IsAuthenticated]

  def post(self, request):
    requester = request.user
    if getattr(requester, "role", "") != "Admin":
      return Response({"detail": "Only Admin can create users"}, status=403)
    email = request.data.get("email")
    role = request.data.get("role", "Worker")
    if not email:
      return Response({"detail": "email required"}, status=400)
    User = get_user_model()
    password = get_random_string(12)
    user, created = User.objects.get_or_create(
      username=email,
      defaults={
        "email": email,
        "role": role,
        "organization": requester.organization,
        "branch": getattr(requester, "branch", None),
      },
    )
    if not created:
      return Response({"detail": "user already exists"}, status=400)
    user.set_password(password)
    user.save()
    return Response({"id": user.id, "username": user.username, "email": user.email, "role": user.role, "password": password})


class NotificationPrefView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    return Response(request.user.notification_prefs or {})

  def post(self, request):
    prefs = request.data or {}
    request.user.notification_prefs = prefs
    request.user.save(update_fields=['notification_prefs'])
    return Response(prefs)


class TeamViewSet(viewsets.ModelViewSet):
  serializer_class = TeamSerializer
  permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
  required_perm = 'teams.view'
  permission_map = {
    'create': 'teams.edit',
    'update': 'teams.edit',
    'partial_update': 'teams.edit',
    'destroy': 'teams.edit',
  }
  filter_backends = [filters.SearchFilter, filters.OrderingFilter]
  search_fields = ['name']
  ordering_fields = ['name']

  def get_queryset(self):
    qs = Team.objects.all()
    org = getattr(self.request.user, 'organization', None)
    if org:
      qs = qs.filter(organization=org)
    return qs

  def perform_create(self, serializer):
    serializer.save(organization=self.request.user.organization)
