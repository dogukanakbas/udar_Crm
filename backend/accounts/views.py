from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth import get_user_model
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.conf import settings
import pyotp
import secrets
from .serializers import TwoFATokenObtainPairSerializer
from .models import Permission, RolePermission
from rest_framework import status
from django.contrib.auth.hashers import check_password
from audit.utils import log_entity_action
from django.core.signing import TimestampSigner
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


class RateLimitedTokenObtainPairView(TokenObtainPairView):
  """
  JWT login endpoint with scoped throttle ("login").
  """
  throttle_classes = [ScopedRateThrottle]
  throttle_scope = 'login'
  serializer_class = TwoFATokenObtainPairSerializer


class PasswordResetRequestView(APIView):
  permission_classes = [AllowAny]

  def post(self, request):
    email = (request.data.get("email") or "").strip().lower()
    if not email:
      return Response({"detail": "email gerekli"}, status=400)
    User = get_user_model()
    try:
      user = User.objects.get(email=email)
    except User.DoesNotExist:
      # Gizlilik için her durumda aynı yanıt
      return Response({"detail": "Eğer email kayıtlıysa şifre sıfırlama gönderildi."})

    # Token üret
    token = default_token_generator.make_token(user)
    signer = TimestampSigner()
    signed = signer.sign(f"{user.pk}:{token}")
    reset_url = f"{getattr(settings, 'FRONTEND_URL', '').rstrip('/')}/reset-password?token={signed}"

    # E-posta gönder (stub mevcut)
    from support.utils import send_email
    send_email(
      to_email=email,
      subject="Şifre sıfırlama",
      body=f"Şifrenizi sıfırlamak için: {reset_url}",
    )
    return Response({"detail": "Eğer email kayıtlıysa şifre sıfırlama gönderildi."})


class PasswordResetConfirmView(APIView):
  permission_classes = [AllowAny]

  def post(self, request):
    token_signed = request.data.get("token")
    new_password = request.data.get("password")
    if not token_signed or not new_password:
      return Response({"detail": "token ve password gerekli"}, status=400)
    signer = TimestampSigner()
    try:
      raw = signer.unsign(token_signed, max_age=60 * 60 * 24)  # 24 saat
    except SignatureExpired:
      return Response({"detail": "Token süresi dolmuş"}, status=400)
    except BadSignature:
      return Response({"detail": "Token geçersiz"}, status=400)

    try:
      user_id, dj_token = raw.split(":", 1)
      User = get_user_model()
      user = User.objects.get(pk=user_id)
    except Exception:
      return Response({"detail": "Token geçersiz"}, status=400)

    if not default_token_generator.check_token(user, dj_token):
      return Response({"detail": "Token doğrulanamadı"}, status=400)

    user.set_password(new_password)
    user.save(update_fields=["password"])
    return Response({"detail": "Şifre güncellendi"})


class InviteUserView(APIView):
  permission_classes = [IsAuthenticated]

  def post(self, request):
    if getattr(request.user, "role", "") != "Admin":
      return Response({"detail": "Only Admin"}, status=status.HTTP_403_FORBIDDEN)
    email = (request.data.get("email") or "").strip().lower()
    role = request.data.get("role") or "Worker"
    if not email:
      return Response({"detail": "email gerekli"}, status=status.HTTP_400_BAD_REQUEST)
    User = get_user_model()
    user, created = User.objects.get_or_create(username=email, defaults={"email": email, "role": role, "is_active": False})
    if not created:
      user.is_active = False
      user.save(update_fields=["is_active"])
    signer = TimestampSigner()
    token = signer.sign(f"{user.pk}:{user.email}")
    activate_url = f"{getattr(settings, 'FRONTEND_URL', '').rstrip('/')}/activate?token={token}"
    from support.utils import send_email
    send_email(
      to_email=email,
      subject="Davet: Hesabınızı aktifleştirin",
      body=f"Hesabınızı aktifleştirmek için: {activate_url}",
    )
    log_entity_action(user, 'invited', user=request.user)
    return Response({"detail": "Davet gönderildi", "token": token, "activate_url": activate_url})


class ActivateUserView(APIView):
  permission_classes = [AllowAny]

  def post(self, request):
    token = request.data.get("token")
    password = request.data.get("password")
    if not token or not password:
      return Response({"detail": "token ve password gerekli"}, status=status.HTTP_400_BAD_REQUEST)
    signer = TimestampSigner()
    try:
      raw = signer.unsign(token, max_age=60 * 60 * 24 * 3)  # 3 gün
      user_id, email = raw.split(":", 1)
    except SignatureExpired:
      return Response({"detail": "Token süresi dolmuş"}, status=400)
    except BadSignature:
      return Response({"detail": "Token geçersiz"}, status=400)
    User = get_user_model()
    try:
      user = User.objects.get(pk=user_id, email=email)
    except User.DoesNotExist:
      return Response({"detail": "Kullanıcı bulunamadı"}, status=400)
    if len(password) < int(os.getenv("PASSWORD_MIN_LENGTH", "10")):
      return Response({"detail": f"Yeni şifre en az {os.getenv('PASSWORD_MIN_LENGTH', '10')} karakter olmalı"}, status=400)
    if not any(c.islower() for c in password) or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password):
      return Response({"detail": "Şifre en az bir küçük, bir büyük harf ve bir rakam içermeli"}, status=400)
    user.set_password(password)
    user.is_active = True
    user.save(update_fields=["password", "is_active"])
    log_entity_action(user, 'activated', user=user)
    return Response({"detail": "Hesap aktifleştirildi"})


class OTPSetupView(APIView):
  permission_classes = [IsAuthenticated]

  def post(self, request):
    user = request.user
    secret = pyotp.random_base32()
    user.otp_secret = secret
    user.otp_enabled = False
    user.save(update_fields=["otp_secret", "otp_enabled"])
    issuer = "Canban"
    label = user.email or user.username
    otpauth_url = pyotp.TOTP(secret).provisioning_uri(name=label, issuer_name=issuer)
    return Response({"secret": secret, "otpauth_url": otpauth_url})


class OTPEnableView(APIView):
  permission_classes = [IsAuthenticated]

  def post(self, request):
    code = request.data.get("otp")
    user = request.user
    if not user.otp_secret:
      return Response({"detail": "Önce /otp/setup çağırın"}, status=400)
    totp = pyotp.TOTP(user.otp_secret)
    if not code or not totp.verify(str(code), valid_window=1):
      return Response({"detail": "OTP doğrulanamadı"}, status=400)
    user.otp_enabled = True
    user.save(update_fields=["otp_enabled"])
    return Response({"detail": "2FA etkinleştirildi"})


class OTPDisableView(APIView):
  permission_classes = [IsAuthenticated]

  def post(self, request):
    user = request.user
    user.otp_enabled = False
    user.otp_secret = ""
    user.save(update_fields=["otp_enabled", "otp_secret"])
    return Response({"detail": "2FA devre dışı bırakıldı"})


class ChangePasswordView(APIView):
  permission_classes = [IsAuthenticated]

  def post(self, request):
    old_password = request.data.get("old_password") or ""
    new_password = request.data.get("new_password") or ""
    if not old_password or not new_password:
      return Response({"detail": "old_password ve new_password gerekli"}, status=status.HTTP_400_BAD_REQUEST)
    user = request.user
    if not user.check_password(old_password):
      return Response({"detail": "Eski şifre yanlış"}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < int(os.getenv("PASSWORD_MIN_LENGTH", "10")):
      return Response({"detail": f"Yeni şifre en az {os.getenv('PASSWORD_MIN_LENGTH', '10')} karakter olmalı"}, status=status.HTTP_400_BAD_REQUEST)
    # Basit karmaşıklık kontrolü
    if not any(c.islower() for c in new_password) or not any(c.isupper() for c in new_password) or not any(c.isdigit() for c in new_password):
      return Response({"detail": "Şifre en az bir küçük, bir büyük harf ve bir rakam içermeli"}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password(new_password)
    user.save(update_fields=["password"])
    log_entity_action(user, 'password_change', user=user)
    return Response({"detail": "Şifre güncellendi"})


class PermissionListView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    perms = list(Permission.objects.all().values_list("code", flat=True))
    return Response({"permissions": perms})


class RolePermissionView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    # Only Admin users can view/edit role permissions
    if getattr(request.user, "role", "") != "Admin":
      return Response({"detail": "Only Admin"}, status=status.HTTP_403_FORBIDDEN)
    data = {}
    for rp in RolePermission.objects.select_related("permission"):
      data.setdefault(rp.role, []).append(rp.permission.code)
    return Response(data)

  def post(self, request):
    if getattr(request.user, "role", "") != "Admin":
      return Response({"detail": "Only Admin"}, status=status.HTTP_403_FORBIDDEN)
    role = request.data.get("role")
    codes = request.data.get("permissions") or []
    if not role or not isinstance(codes, list):
      return Response({"detail": "role ve permissions list gerekli"}, status=status.HTTP_400_BAD_REQUEST)
    perms = list(Permission.objects.filter(code__in=codes))
    # Replace mappings
    RolePermission.objects.filter(role=role).delete()
    RolePermission.objects.bulk_create([RolePermission(role=role, permission=p) for p in perms])
    return Response({"role": role, "permissions": [p.code for p in perms]})


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
