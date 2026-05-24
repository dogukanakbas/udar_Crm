from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.throttling import ScopedRateThrottle
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth import get_user_model
from django.core.signing import TimestampSigner, BadSignature, SignatureExpired
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError, RestrictedError
import logging
import os
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
from django.core.exceptions import ValidationError as DjangoValidationError
from django.contrib.auth.validators import UnicodeUsernameValidator
from .user_import import allocate_username, full_name_to_username_base, split_full_name
from rest_framework import viewsets, permissions, filters
from permissions import IsOrgMember, HasAPIPermission
from .models import Team, TeamAssociate, OrganizationSettings
from .payment_options import normalize_payment_options
from .price_lists import DEFAULT_PRICE_LIST_LABEL, get_default_price_list, normalize_price_lists
from .serializers import TeamSerializer, TeamAssociateSerializer
from .utils import ensure_permissions_seeded, get_effective_permissions, user_has_perm


logger = logging.getLogger(__name__)


class MeView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    ensure_permissions_seeded()
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
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "role": getattr(user, "role", None),
        "organization": user.organization.id if user.organization else None,
        "is_superadmin": getattr(user, "is_superadmin", False),  # NEW: for auth gateway
      }
    )


class UsersListView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    ensure_permissions_seeded()
    User = get_user_model()
    qs = User.objects.all()
    org = getattr(request.user, "organization", None)
    if org:
      qs = qs.filter(organization=org)
    data = [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email or "",
            "role": u.role,
            "first_name": u.first_name or "",
            "last_name": u.last_name or "",
            "full_name": f"{(u.first_name or '').strip()} {(u.last_name or '').strip()}".strip() or u.username,
            "permissions": get_effective_permissions(u),
            "can_prepare_quotes": user_has_perm(u, "quotes.prepare"),
        }
        for u in qs
    ]
    return Response(data)


class DeleteUserView(APIView):
  """Admin: organizasyondaki kullanıcıyı kalıcı siler (FK'ler SET_NULL ise güvenli)."""

  permission_classes = [IsAuthenticated]

  def patch(self, request, pk):
    if getattr(request.user, "role", "") != "Admin":
      return Response({"detail": "Yalnızca Admin kullanıcı güncelleyebilir"}, status=status.HTTP_403_FORBIDDEN)

    User = get_user_model()
    org = getattr(request.user, "organization", None)
    if not org:
      return Response({"detail": "Organizasyon bulunamadı"}, status=status.HTTP_400_BAD_REQUEST)

    try:
      user = User.objects.get(pk=pk, organization=org)
    except User.DoesNotExist:
      return Response({"detail": "Kullanıcı bulunamadı"}, status=status.HTTP_404_NOT_FOUND)

    username = (request.data.get("username") or user.username or "").strip()
    email = (request.data.get("email") or "").strip()
    role = (request.data.get("role") or user.role or "").strip()
    first_name = (request.data.get("first_name") or "").strip()
    last_name = (request.data.get("last_name") or "").strip()
    full_name = (request.data.get("full_name") or "").strip()

    if full_name and not first_name and not last_name:
      first_name, last_name = split_full_name(full_name)

    if not username:
      return Response({"detail": "Kullanıcı adı zorunludur"}, status=status.HTTP_400_BAD_REQUEST)

    try:
      UnicodeUsernameValidator()(username)
    except DjangoValidationError as e:
      return Response({"detail": " ".join(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

    existing = User.objects.filter(username=username).exclude(pk=user.pk).first()
    if existing:
      if existing.organization_id != org.id:
        return Response(
            {"detail": "Bu kullanıcı adı başka bir organizasyonda kayıtlı."},
            status=status.HTTP_400_BAD_REQUEST,
        )
      return Response(
          {"detail": "Bu kullanıcı adı organizasyonda zaten var."},
          status=status.HTTP_400_BAD_REQUEST,
      )

    user.username = username
    user.email = email
    user.role = role or user.role
    user.first_name = first_name
    user.last_name = last_name
    user.save(update_fields=["username", "email", "role", "first_name", "last_name"])
    log_entity_action(user, "updated", user=request.user)

    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "role": user.role,
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "full_name": f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip() or user.username,
            "permissions": get_effective_permissions(user),
            "can_prepare_quotes": user_has_perm(user, "quotes.prepare"),
        }
    )

  def delete(self, request, pk):
    if getattr(request.user, "role", "") != "Admin":
      return Response({"detail": "Yalnızca Admin kullanıcı silebilir"}, status=status.HTTP_403_FORBIDDEN)
    if str(request.user.pk) == str(pk):
      return Response({"detail": "Kendi hesabınızı silemezsiniz"}, status=status.HTTP_400_BAD_REQUEST)
    User = get_user_model()
    org = getattr(request.user, "organization", None)
    if not org:
      return Response({"detail": "Organizasyon bulunamadı"}, status=status.HTTP_400_BAD_REQUEST)
    try:
      user = User.objects.get(pk=pk, organization=org)
    except User.DoesNotExist:
      return Response({"detail": "Kullanıcı bulunamadı"}, status=status.HTTP_404_NOT_FOUND)

    audit_snapshot = {
        "username": user.username,
        "email": user.email or "",
        "role": user.role,
        "full_name": f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip(),
    }

    try:
      with transaction.atomic():
        user.teams.clear()
        try:
          log_entity_action(user, "deleted", user=request.user, old_value=audit_snapshot)
        except Exception:
          logger.exception("Kullanıcı silme audit kaydı oluşturulamadı", extra={"deleted_user_id": user.pk})
        user.delete()
    except (ProtectedError, RestrictedError) as exc:
      logger.exception("Kullanıcı ilişkili kayıtlar nedeniyle silinemedi", extra={"deleted_user_id": pk})
      return Response(
          {
              "detail": (
                  "Bu kullanıcıya bağlı kayıtlar olduğu için kullanıcı silinemedi. "
                  "Önce bağlı görev, kayıt veya işlem sahipliklerini başka kullanıcıya aktarın."
              ),
              "error": str(exc),
          },
          status=status.HTTP_400_BAD_REQUEST,
      )
    except IntegrityError as exc:
      logger.exception("Kullanıcı silinirken veritabanı bütünlük hatası oluştu", extra={"deleted_user_id": pk})
      return Response(
          {
              "detail": (
                  "Kullanıcı silinemedi. Bu kullanıcıya bağlı eski kayıtlar veritabanında duruyor olabilir; "
                  "ilişkili kayıtlar temizlendikten veya başka kullanıcıya aktarıldıktan sonra tekrar deneyin."
              ),
              "error": str(exc),
          },
          status=status.HTTP_400_BAD_REQUEST,
      )
    except Exception as exc:
      logger.exception("Kullanıcı silinirken beklenmeyen hata oluştu", extra={"deleted_user_id": pk})
      return Response(
          {"detail": "Kullanıcı silinirken beklenmeyen bir hata oluştu.", "error": str(exc)},
          status=status.HTTP_500_INTERNAL_SERVER_ERROR,
      )

    return Response(status=status.HTTP_204_NO_CONTENT)


class CreateUserView(APIView):
  permission_classes = [IsAuthenticated]

  def post(self, request):
    requester = request.user
    if getattr(requester, "role", "") != "Admin":
      return Response({"detail": "Yalnızca Admin kullanıcı oluşturabilir"}, status=403)
    org = getattr(requester, "organization", None)
    if not org:
      return Response({"detail": "Organizasyon bulunamadı"}, status=400)

    username_in = (request.data.get("username") or "").strip()
    email_in = (request.data.get("email") or "").strip()
    full_name = (request.data.get("full_name") or "").strip()
    role = request.data.get("role", "Worker")
    User = get_user_model()

    if username_in:
      username = username_in
      email = email_in
    elif email_in:
      username = email_in
      email = email_in
    else:
      return Response(
          {
              "detail": "Kullanıcı adı veya e-posta zorunludur. "
              "E-postası olmayan kişiler için kullanıcı adı + (isteğe bağlı) ad soyad kullanın; girişte şifre ile kullanıcı adı yeterlidir.",
          },
          status=400,
      )

    try:
      UnicodeUsernameValidator()(username)
    except DjangoValidationError as e:
      return Response({"detail": " ".join(e.messages)}, status=400)

    first_name, last_name = split_full_name(full_name) if full_name else ("", "")

    existing = User.objects.filter(username=username).first()
    if existing:
      if existing.organization_id != org.id:
        return Response(
            {"detail": "Bu kullanıcı adı başka bir organizasyonda kayıtlı."},
            status=400,
        )
      return Response(
          {"detail": "Bu kullanıcı adı organizasyonda zaten var."},
          status=400,
      )
    password = get_random_string(12)
    user = User(
        username=username,
        email=email or "",
        first_name=first_name,
        last_name=last_name,
        role=role,
        organization=org,
        branch=getattr(requester, "branch", None),
    )
    user.set_password(password)
    user.save()
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email or "",
            "role": user.role,
            "password": password,
            "first_name": user.first_name,
            "last_name": user.last_name,
        }
    )


class BulkCreateUsersView(APIView):
  """Admin: Her satır 'Ad Soyad' — benzersiz kullanıcı adı ve şifre üretilir (e-posta zorunlu değil)."""

  permission_classes = [IsAuthenticated]

  def post(self, request):
    requester = request.user
    if getattr(requester, "role", "") != "Admin":
      return Response({"detail": "Yalnızca Admin kullanıcı oluşturabilir"}, status=403)
    org = getattr(requester, "organization", None)
    if not org:
      return Response({"detail": "Organizasyon bulunamadı"}, status=400)

    role = request.data.get("role", "Worker")
    lines_raw = request.data.get("lines")
    if isinstance(lines_raw, str):
      lines = [ln.strip() for ln in lines_raw.replace("\r\n", "\n").split("\n") if ln.strip()]
    elif isinstance(lines_raw, list):
      lines = [str(ln).strip() for ln in lines_raw if str(ln).strip()]
    else:
      return Response({"detail": "lines alanı gerekli (çok satırlı metin veya dizi)."}, status=400)

    User = get_user_model()
    taken_this_batch: set[str] = set()
    created = []
    errors = []

    def is_taken(uname: str) -> bool:
      if uname in taken_this_batch:
        return True
      return User.objects.filter(username=uname).exists()

    for idx, full_name in enumerate(lines, start=1):
      if not full_name or len(full_name) > 200:
        errors.append({"line": idx, "full_name": full_name[:50] if full_name else "", "detail": "Geçersiz satır"})
        continue
      base = full_name_to_username_base(full_name)
      try:
        uname = allocate_username(base, is_taken)
      except ValueError as e:
        errors.append({"line": idx, "full_name": full_name, "detail": str(e)})
        continue
      taken_this_batch.add(uname)
      first_name, last_name = split_full_name(full_name)
      password = get_random_string(12)
      user = User(
          username=uname,
          email="",
          first_name=first_name,
          last_name=last_name,
          role=role,
          organization=org,
          branch=getattr(requester, "branch", None),
      )
      user.set_password(password)
      user.save()
      created.append(
          {
              "id": user.id,
              "username": user.username,
              "password": password,
              "full_name": full_name,
              "first_name": first_name,
              "last_name": last_name,
          }
      )

    return Response({"created": created, "errors": errors, "summary": f"{len(created)} oluşturuldu, {len(errors)} satır atlandı"})


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
    try:
      log_entity_action(user, 'password_change', user=user)
    except Exception:
      # Audit yazımı başarısız olsa da şifre değişimi başarılı kalmalı.
      pass
    return Response({"detail": "Şifre güncellendi"})


class PermissionListView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    ensure_permissions_seeded()
    perms = list(Permission.objects.all().values_list("code", flat=True))
    return Response({"permissions": perms})


class RolePermissionView(APIView):
  permission_classes = [IsAuthenticated]

  def get(self, request):
    ensure_permissions_seeded()
    # Only Admin users can view/edit role permissions
    if getattr(request.user, "role", "") != "Admin":
      return Response({"detail": "Only Admin"}, status=status.HTTP_403_FORBIDDEN)
    data = {}
    for rp in RolePermission.objects.select_related("permission"):
      data.setdefault(rp.role, []).append(rp.permission.code)
    return Response(data)

  def post(self, request):
    ensure_permissions_seeded()
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
    qs = Team.objects.all().select_related('leader').prefetch_related('members')
    org = getattr(self.request.user, 'organization', None)
    if org:
      qs = qs.filter(organization=org)
    return qs

  def perform_create(self, serializer):
    serializer.save(organization=self.request.user.organization)


class TeamAssociateViewSet(viewsets.ModelViewSet):
  """Hesapsız ekip çalışanları (CRUD)."""

  serializer_class = TeamAssociateSerializer
  permission_classes = [permissions.IsAuthenticated, IsOrgMember, HasAPIPermission]
  required_perm = 'teams.view'
  permission_map = {
    'create': 'teams.edit',
    'update': 'teams.edit',
    'partial_update': 'teams.edit',
    'destroy': 'teams.edit',
  }
  filter_backends = [filters.SearchFilter, filters.OrderingFilter]
  search_fields = ['full_name', 'phone', 'notes']
  ordering_fields = ['full_name', 'created_at']

  def get_queryset(self):
    qs = TeamAssociate.objects.all().prefetch_related('teams')
    org = getattr(self.request.user, 'organization', None)
    if org:
      qs = qs.filter(organization=org)
    return qs

  def perform_create(self, serializer):
    serializer.save(organization=self.request.user.organization)


class OrganizationSettingsView(APIView):
  permission_classes = [IsAuthenticated, IsOrgMember]

  def _serialize(self, settings_row):
    price_lists = normalize_price_lists(settings_row.price_lists, settings_row.price_list_label)
    default_price_list = get_default_price_list(price_lists)
    return {
      "working_hours_start": settings_row.working_hours_start.strftime("%H:%M"),
      "working_hours_end": settings_row.working_hours_end.strftime("%H:%M"),
      "working_days": settings_row.working_days or [0, 1, 2, 3, 4],
      "price_list_label": default_price_list.get("label") or DEFAULT_PRICE_LIST_LABEL,
      "price_lists": price_lists,
      "payment_options": normalize_payment_options(settings_row.payment_options),
    }

  def get(self, request):
    # Mesai ayarları tüm org üyeleri tarafından okunabilir (görev zamanlaması için)
    org = request.user.organization
    if not org:
      return Response({"working_hours_start": "08:00", "working_hours_end": "18:00", "working_days": [0, 1, 2, 3, 4], "price_list_label": DEFAULT_PRICE_LIST_LABEL, "price_lists": normalize_price_lists(None), "payment_options": normalize_payment_options(None)})
    try:
      s = OrganizationSettings.objects.get(organization=org)
      return Response(self._serialize(s))
    except OrganizationSettings.DoesNotExist:
      return Response({"working_hours_start": "08:00", "working_hours_end": "18:00", "working_days": [0, 1, 2, 3, 4], "price_list_label": DEFAULT_PRICE_LIST_LABEL, "price_lists": normalize_price_lists(None), "payment_options": normalize_payment_options(None)})

  def patch(self, request):
    if getattr(request.user, "role", "") != "Admin":
      return Response({"detail": "Sadece Admin güncelleyebilir"}, status=status.HTTP_403_FORBIDDEN)
    org = request.user.organization
    if not org:
      return Response({"detail": "Organizasyon bulunamadı"}, status=status.HTTP_400_BAD_REQUEST)
    s, _ = OrganizationSettings.objects.get_or_create(organization=org)
    start = request.data.get("working_hours_start")
    end = request.data.get("working_hours_end")
    days = request.data.get("working_days")
    price_list_label = request.data.get("price_list_label")
    price_lists = request.data.get("price_lists")
    payment_options = request.data.get("payment_options")
    if start:
      from datetime import datetime
      try:
        s.working_hours_start = datetime.strptime(start, "%H:%M").time()
      except ValueError:
        pass
    if end:
      from datetime import datetime
      try:
        s.working_hours_end = datetime.strptime(end, "%H:%M").time()
      except ValueError:
        pass
    if days is not None:
      s.working_days = [int(x) for x in days if str(x).isdigit()]
    if price_list_label is not None:
      value = str(price_list_label).strip()
      s.price_list_label = value or DEFAULT_PRICE_LIST_LABEL
    if price_lists is not None:
      s.price_lists = normalize_price_lists(price_lists, s.price_list_label)
      s.price_list_label = get_default_price_list(s.price_lists).get("label") or DEFAULT_PRICE_LIST_LABEL
    elif not s.price_lists:
      s.price_lists = normalize_price_lists(None, s.price_list_label)
    if payment_options is not None:
      s.payment_options = normalize_payment_options(payment_options)
    elif not s.payment_options:
      s.payment_options = normalize_payment_options(None)
    s.save()
    return Response(self._serialize(s))
