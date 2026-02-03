from django.db import models
from organizations.models import Organization
from accounts.models import User
from crm.models import Quote


class ApprovalInstance(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='approvals')
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name='approvals')
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=20, default='Waiting')


class ApprovalStep(models.Model):
    instance = models.ForeignKey(ApprovalInstance, on_delete=models.CASCADE, related_name='steps')
    role = models.CharField(max_length=20)
    status = models.CharField(max_length=20, default='Waiting')
    comment = models.TextField(blank=True)
    acted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
from django.db import models

# Create your models here.
