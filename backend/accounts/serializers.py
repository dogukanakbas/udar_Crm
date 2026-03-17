from rest_framework import serializers
from .models import Team
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
import pyotp


class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ['id', 'name', 'organization', 'members']
        read_only_fields = ['organization']


class TwoFATokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends JWT login to require otp code if user has otp_enabled.
    Worker için mesai saat/gün kontrolü.
    """

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        if getattr(user, "otp_enabled", False):
            code = self.context['request'].data.get('otp')
            secret = getattr(user, "otp_secret", "") or ""
            totp = pyotp.TOTP(secret) if secret else None
            if not code or not totp or not totp.verify(str(code), valid_window=1):
                raise serializers.ValidationError({"otp": "OTP doğrulanamadı"})

        if getattr(user, "role", "") == "Worker":
            from django.utils import timezone
            from .models import OrganizationSettings
            org = getattr(user, "organization", None)
            if org:
                try:
                    s = OrganizationSettings.objects.get(organization=org)
                except OrganizationSettings.DoesNotExist:
                    s = None
                if s and s.working_days:
                    now = timezone.localtime(timezone.now())
                    wd = now.weekday()
                    if wd not in s.working_days:
                        raise serializers.ValidationError({
                            "detail": "Mesai günleri dışında giriş yapılamaz. Lütfen mesai günlerinde tekrar deneyin."
                        })
                    now_time = now.time()
                    if now_time < s.working_hours_start or now_time > s.working_hours_end:
                        raise serializers.ValidationError({
                            "detail": f"Mesai saatleri dışında giriş yapılamaz. Mesai: {s.working_hours_start.strftime('%H:%M')}-{s.working_hours_end.strftime('%H:%M')}"
                        })
        return data


