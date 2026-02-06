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
        return data


