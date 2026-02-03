from rest_framework import serializers
from .models import ApprovalInstance, ApprovalStep


class ApprovalStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalStep
        fields = ['id', 'role', 'status', 'comment', 'acted_by', 'updated_at']


class ApprovalInstanceSerializer(serializers.ModelSerializer):
    steps = ApprovalStepSerializer(many=True, read_only=True)
    quote_number = serializers.CharField(source='quote.number', read_only=True)

    class Meta:
        model = ApprovalInstance
        fields = ['id', 'quote', 'quote_number', 'status', 'created_at', 'steps']

