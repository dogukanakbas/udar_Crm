"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework import routers

from crm.views import QuoteViewSet, PricingRuleViewSet, BusinessPartnerViewSet, LeadViewSet, OpportunityViewSet, ContactViewSet
from erp.views import ProductViewSet as ERPProductViewSet, CategoryViewSet, InvoiceViewSet, SalesOrderViewSet, PurchaseOrderViewSet, StockMovementViewSet, VehicleViewSet
from accounts.views import TeamViewSet
from core.views import DashboardKPIView, GlobalSearchView, CalendarICSView, SSEView
from workflow.views import PendingApprovalsView, ApprovalInstanceViewSet, ApprovalActionView
from audit.views import AuditLogViewSet
from core.views import health
from support.views import (
    TicketViewSet,
    TicketMessageViewSet,
    TaskViewSet,
    TaskAttachmentViewSet,
    TaskCommentViewSet,
    TaskChecklistViewSet,
    UploadPresignView,
    AutomationRuleViewSet,
    TaskTimeEntryViewSet,
)

router = routers.DefaultRouter()
router.register(r'quotes', QuoteViewSet, basename='quotes')
router.register(r'pricing-rules', PricingRuleViewSet, basename='pricing-rules')
router.register(r'partners', BusinessPartnerViewSet, basename='partners')
router.register(r'contacts', ContactViewSet, basename='contacts')
router.register(r'leads', LeadViewSet, basename='leads')
router.register(r'opportunities', OpportunityViewSet, basename='opportunities')
router.register(r'products', ERPProductViewSet, basename='products')
router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'invoices', InvoiceViewSet, basename='invoices')
router.register(r'sales-orders', SalesOrderViewSet, basename='sales-orders')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-orders')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movements')
router.register(r'vehicles', VehicleViewSet, basename='vehicles')
router.register(r'tickets', TicketViewSet, basename='tickets')
router.register(r'ticket-messages', TicketMessageViewSet, basename='ticket-messages')
router.register(r'audit', AuditLogViewSet, basename='audit-logs')
router.register(r'approvals', ApprovalInstanceViewSet, basename='approvals')
router.register(r'tasks', TaskViewSet, basename='tasks')
router.register(r'task-attachments', TaskAttachmentViewSet, basename='task-attachments')
router.register(r'task-comments', TaskCommentViewSet, basename='task-comments')
router.register(r'task-checklist', TaskChecklistViewSet, basename='task-checklist')
router.register(r'automation-rules', AutomationRuleViewSet, basename='automation-rules')
router.register(r'task-time-entries', TaskTimeEntryViewSet, basename='task-time-entries')
router.register(r'teams', TeamViewSet, basename='teams')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
    path('api/auth/', include('accounts.urls')),
    path('api/', include(router.urls)),
    path('api/dashboard/kpis/', DashboardKPIView.as_view(), name='dashboard-kpis'),
    path('api/search/', GlobalSearchView.as_view(), name='global-search'),
    path('api/approvals/pending/', PendingApprovalsView.as_view(), name='approvals-pending'),
    path('api/approvals/step/<int:pk>/action/', ApprovalActionView.as_view(), name='approval-action'),
    path('api/uploads/presign/', UploadPresignView.as_view(), name='upload-presign'),
    path('api/calendar/ics/', CalendarICSView.as_view(), name='calendar-ics'),
    path('api/stream/', SSEView.as_view(), name='sse-stream'),
    path('health/', health),
]
