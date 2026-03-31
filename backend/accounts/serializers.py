from rest_framework import serializers
from .models import Team, TeamAssociate, User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
import pyotp


class TeamSerializer(serializers.ModelSerializer):
    """
    members: yazarken tamsayı pk listesi (JSON [1,2,3]).
    Geçersiz veya başka organizasyona ait pk'lar sessizçe düşürülür — böylece silinmiş
    kullanıcı kalıntıları yüzünden PATCH 400 oluşmaz.
    """
    members = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
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
            self.fields['leader'].queryset = User.objects.filter(organization=org)

    def _org_for_write(self):
        request = self.context.get('request')
        if self.instance:
            return self.instance.organization
        return getattr(getattr(request, 'user', None), 'organization', None)

    def _normalize_member_pks(self, value):
        """Organizasyondaki geçerli üye pk listesi; sırayı koru, yinelenen/ geçersiz at."""
        if value is None:
            return None
        org = self._org_for_write()
        if not org:
            return []
        allowed = set(User.objects.filter(organization=org).values_list('pk', flat=True))
        out, seen = [], set()
        for raw in value:
            try:
                pk = int(raw)
            except (TypeError, ValueError):
                continue
            if pk in allowed and pk not in seen:
                out.append(pk)
                seen.add(pk)
        return out

    def validate_members(self, value):
        if value is None:
            return None
        return self._normalize_member_pks(value)

    def validate(self, attrs):
        members = attrs.get('members', None)
        leader = attrs.get('leader', serializers.empty)
        leader_obj = None if leader is serializers.empty else leader

        if leader_obj:
            if members is not None:
                mids = list(members)
                if leader_obj.pk not in mids:
                    attrs['members'] = mids + [leader_obj.pk]
            elif self.instance is not None:
                current = list(self.instance.members.values_list('pk', flat=True))
                if leader_obj.pk not in current:
                    attrs['members'] = current + [leader_obj.pk]

        members = attrs.get('members', None)
        if members is not None:
            attrs['members'] = self._normalize_member_pks(members)
        return attrs

    def to_representation(self, instance):
        return {
            'id': instance.id,
            'name': instance.name,
            'organization': instance.organization_id,
            'members': list(instance.members.values_list('pk', flat=True)),
            'leader': instance.leader_id,
        }

    def create(self, validated_data):
        members_ids = validated_data.pop('members', None)
        instance = super().create(validated_data)
        if members_ids is not None:
            instance.members.set(User.objects.filter(pk__in=members_ids))
        self._clear_leader_if_not_member(instance)
        return instance

    def update(self, instance, validated_data):
        members_ids = validated_data.pop('members', None)
        instance = super().update(instance, validated_data)
        if members_ids is not None:
            instance.members.set(User.objects.filter(pk__in=members_ids))
        self._clear_leader_if_not_member(instance)
        return instance

    def _clear_leader_if_not_member(self, instance):
        if instance.leader_id and not instance.members.filter(id=instance.leader_id).exists():
            instance.leader = None
            instance.save(update_fields=['leader'])


class TeamAssociateSerializer(serializers.ModelSerializer):
    """Hesapsız ekip çalışanı: teams = ekip pk listesi."""

    teams = serializers.ListField(child=serializers.IntegerField(), required=False, allow_empty=True)

    class Meta:
        model = TeamAssociate
        fields = ['id', 'full_name', 'phone', 'notes', 'teams', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def _valid_team_pks(self, org, raw_ids):
        if org is None:
            return []
        allowed = set(Team.objects.filter(organization=org).values_list('pk', flat=True))
        out, seen = [], set()
        for raw in raw_ids or []:
            try:
                pk = int(raw)
            except (TypeError, ValueError):
                continue
            if pk in allowed and pk not in seen:
                out.append(pk)
                seen.add(pk)
        return out

    def validate_teams(self, value):
        request = self.context.get('request')
        org = getattr(getattr(request, 'user', None), 'organization', None)
        return self._valid_team_pks(org, value)

    def create(self, validated_data):
        request = self.context.get('request')
        org = getattr(request.user, 'organization', None) if request else None
        team_ids = validated_data.pop('teams', [])
        validated_data.pop('organization', None)
        inst = TeamAssociate.objects.create(organization=org, **validated_data)
        if team_ids is not None:
            ids = self._valid_team_pks(org, team_ids)
            inst.teams.set(Team.objects.filter(pk__in=ids, organization=org))
        return inst

    def update(self, instance, validated_data):
        request = self.context.get('request')
        org = instance.organization or getattr(getattr(request, 'user', None), 'organization', None)
        team_ids = validated_data.pop('teams', None)
        for k, v in validated_data.items():
            setattr(instance, k, v)
        instance.save()
        if team_ids is not None:
            ids = self._valid_team_pks(org, team_ids)
            instance.teams.set(Team.objects.filter(pk__in=ids, organization=org))
        return instance

    def to_representation(self, instance):
        return {
            'id': instance.id,
            'full_name': instance.full_name,
            'phone': instance.phone or '',
            'notes': instance.notes or '',
            'teams': list(instance.teams.values_list('pk', flat=True)),
            'is_active': instance.is_active,
            'created_at': instance.created_at.isoformat() if instance.created_at else None,
            'updated_at': instance.updated_at.isoformat() if instance.updated_at else None,
        }


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
