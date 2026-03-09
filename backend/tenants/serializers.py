from rest_framework import serializers
from .models import TenantPlan, TenantSubscription
from organizations.models import Organization


class TenantPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantPlan
        fields = '__all__'


class TenantSubscriptionSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    
    class Meta:
        model = TenantSubscription
        fields = '__all__'


class TenantDetailSerializer(serializers.ModelSerializer):
    """Detailed tenant info for admin"""
    subscription = TenantSubscriptionSerializer(read_only=True)
    user_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Organization
        fields = ['id', 'code', 'name', 'subscription', 'user_count']
    
    def get_user_count(self, obj):
        return obj.users.count()
