from rest_framework import serializers
from .models import Team, User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
import pyotp


class TeamSerializer(serializers.ModelSerializer):
    members = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.none(), required=False
    )
    leader = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.none(), allow_null=True, required=False
    )

    class Meta:
        model = Team
        fields = ['id', 'name', 'organization', 'members', 'leader']
        read_only_fields = ['organization']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        org = getattr(getattr(request, 'user', None), 'organization', None) if request else None
        if org:
            qs = User.objects.filter(organization=org)
            self.fields['members'].queryset = qs
            self.fields['leader'].queryset = qs

    def validate(self, attrs):
        members = attrs.get('members')
        leader = attrs.get('leader', serializers.empty)
        leader_obj = None if leader is serializers.empty else leader
        if leader_obj:
            if members is not None:
                m_ids = {getattr(m, 'pk', m) for m in members}
                if leader_obj.pk not in m_ids:
                    raise serializers.ValidationError({'leader': 'Usta başı mutlaka ekip üyelerinden biri olmalıdır.'})
            elif self.instance is not None:
                if not self.instance.members.filter(id=leader_obj.pk).exists():
                    raise serializers.ValidationError({'leader': 'Usta başı mutlaka ekip üyelerinden biri olmalıdır.'})
        return attrs

    def create(self, validated_data):
        members = validated_data.pop('members', None)
        instance = Team.objects.create(**validated_data)
        if members is not None:
            instance.members.set(members)
        self._clear_leader_if_not_member(instance)
        return instance

    def update(self, instance, validated_data):
        members = validated_data.pop('members', None)
        instance = super().update(instance, validated_data)
        if members is not None:
            instance.members.set(members)
        self._clear_leader_if_not_member(instance)
        return instance

    def _clear_leader_if_not_member(self, instance):
        if instance.leader_id and not instance.members.filter(id=instance.leader_id).exists():
            instance.leader = None
            instance.save(update_fields=['leader'])


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
                    # JSON'dan gelen günler bazen string olabiliyor; weekday ile karşılaştır
                    working_days_int = []
                    for x in s.working_days:
                        try:
                            working_days_int.append(int(x))
                        except (TypeError, ValueError):
                            continue
                    if working_days_int and wd not in working_days_int:
                        raise serializers.ValidationError({
                            "detail": "Mesai günleri dışında giriş yapılamaz. Lütfen mesai günlerinde tekrar deneyin."
                        })
                    now_time = now.time()
                    if now_time < s.working_hours_start or now_time > s.working_hours_end:
                        raise serializers.ValidationError({
                            "detail": f"Mesai saatleri dışında giriş yapılamaz. Mesai: {s.working_hours_start.strftime('%H:%M')}-{s.working_hours_end.strftime('%H:%M')}"
                        })
        return data

