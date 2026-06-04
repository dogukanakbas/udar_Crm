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
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework import routers

from crm.views import QuoteViewSet, PricingRuleViewSet, SellerCompanyViewSet, BusinessPartnerViewSet, LeadViewSet, OpportunityViewSet, ContactViewSet
from erp.views import (
    ProductViewSet as ERPProductViewSet,
    CategoryViewSet,
    InvoiceViewSet,
    ProductTechnicalDrawingViewSet,
    SalesOrderViewSet,
    PurchaseOrderViewSet,
    StockMovementViewSet,
    TechnicalDrawingFolderViewSet,
    VehicleViewSet,
    WarehouseViewSet,
    InventoryLocationViewSet,
    WarehouseStockViewSet,
    WarehouseDashboardView,
)
from mdf.views import MdfSkuViewSet
from production.views import (
    ProductionDataFieldViewSet,
    ProductionCountingWindowViewSet,
    ProductionDepartmentViewSet,
    ProductionDeviceViewSet,
    ProductionDevicePayloadMapViewSet,
    ProductionDocumentViewSet,
    ProductionEventViewSet,
    ProductionOperatorProfileViewSet,
    ProductionPiEventView,
    ProductionReportExportView,
    ProductionReportSummaryView,
    ProductionRuleBlockViewSet,
    ProductionRuleSetViewSet,
    ProductionRouteViewSet,
    ProductionSettingsView,
    ProductionStationAlertAckView,
    ProductionStationAlertViewSet,
    ProductionStationConsoleView,
    ProductionShiftBreakViewSet,
    ProductionShiftOccurrenceViewSet,
    ProductionShiftReportSummaryView,
    ProductionShiftScheduleViewSet,
    ProductionStationTabletViewSet,
    ProductionStationTargetViewSet,
    ProductionTabletBreakEndView,
    ProductionTabletBreakStartView,
    ProductionTabletCheckpointView,
    ProductionTabletCompleteWorkItemView,
    ProductionTabletCallManagerView,
    ProductionTabletContextView,
    ProductionTabletLoginSlotView,
    ProductionTabletLogoutSlotView,
    ProductionTabletBatchLogoutSlotView,
    ProductionTabletShiftCheckpointView,
    ProductionSessionCloseView,
    ProductionSessionHandoverView,
    ProductionSessionPauseView,
    ProductionSessionResumeView,
    ProductionSessionReviewView,
    ProductionSessionStartView,
    ProductionStationUserViewSet,
    ProductionStationViewSet,
    ProductionStepTabletAssignmentViewSet,
    ProductionTemplatePresetViewSet,
    ProductionWorkOrderViewSet,
    ProductionWorkSessionViewSet,
    MyDailyProductionSessionsView,
)
from accounts.views import TeamViewSet, TeamAssociateViewSet, UserGroupPermissionView, UserGroupViewSet
from addons.views import (
    AddonCompiledTemplateView,
    AddonNavigationView,
    AddonPhraseView,
    AddonRoutesView,
    AddonStyleBundleView,
    AddonStyleAssetView,
    AddonTemplateModificationView,
    AddonTemplateView,
    AddonUploadView,
    AddonViewSet,
    NavigationDesignerDetailView,
    NavigationDesignerView,
    PermissionCatalogView,
    PhraseBundleView,
)
from core.views import DashboardKPIView, GlobalSearchView, CalendarICSView, SSEView
from workflow.views import PendingApprovalsView, ApprovalInstanceViewSet, ApprovalActionView
from audit.views import AuditLogViewSet
from core.views import health
from support.report_views import TaskReportSummaryView, TaskReportExportView
from support.views import (
    TicketViewSet,
    TicketMessageViewSet,
    TaskViewSet,
    TaskAttachmentViewSet,
    TaskCommentViewSet,
    TaskChecklistViewSet,
    TaskModelViewSet,
    UploadPresignView,
    AutomationRuleViewSet,
    TaskTimeEntryViewSet,
    TaskWorkflowTemplateViewSet,
)
# NEW: Product website imports
from blog.views import PublicBlogViewSet, AdminBlogViewSet, BlogCategoryViewSet
from contact.views import contact_form_submit, AdminContactViewSet
from tenants.views import AdminTenantViewSet, AdminPlanViewSet, AdminSubscriptionViewSet

router = routers.DefaultRouter()
router.register(r'quotes', QuoteViewSet, basename='quotes')
router.register(r'seller-companies', SellerCompanyViewSet, basename='seller-companies')
router.register(r'pricing-rules', PricingRuleViewSet, basename='pricing-rules')
router.register(r'partners', BusinessPartnerViewSet, basename='partners')
router.register(r'contacts', ContactViewSet, basename='contacts')
router.register(r'leads', LeadViewSet, basename='leads')
router.register(r'opportunities', OpportunityViewSet, basename='opportunities')
router.register(r'products', ERPProductViewSet, basename='products')
router.register(r'technical-drawing-folders', TechnicalDrawingFolderViewSet, basename='technical-drawing-folders')
router.register(r'product-technical-drawings', ProductTechnicalDrawingViewSet, basename='product-technical-drawings')
router.register(r'categories', CategoryViewSet, basename='categories')
router.register(r'invoices', InvoiceViewSet, basename='invoices')
router.register(r'sales-orders', SalesOrderViewSet, basename='sales-orders')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-orders')
router.register(r'stock-movements', StockMovementViewSet, basename='stock-movements')
router.register(r'warehouses', WarehouseViewSet, basename='warehouses')
router.register(r'inventory-locations', InventoryLocationViewSet, basename='inventory-locations')
router.register(r'warehouse-stocks', WarehouseStockViewSet, basename='warehouse-stocks')
router.register(r'mdf-skus', MdfSkuViewSet, basename='mdf-skus')
router.register(r'vehicles', VehicleViewSet, basename='vehicles')
router.register(r'production/departments', ProductionDepartmentViewSet, basename='production-departments')
router.register(r'production/stations', ProductionStationViewSet, basename='production-stations')
router.register(r'production/station-users', ProductionStationUserViewSet, basename='production-station-users')
router.register(r'production/devices', ProductionDeviceViewSet, basename='production-devices')
router.register(r'production/operator-profiles', ProductionOperatorProfileViewSet, basename='production-operator-profiles')
router.register(r'production/tablets', ProductionStationTabletViewSet, basename='production-tablets')
router.register(r'production/station-targets', ProductionStationTargetViewSet, basename='production-station-targets')
router.register(r'production/shift-schedules', ProductionShiftScheduleViewSet, basename='production-shift-schedules')
router.register(r'production/shift-breaks', ProductionShiftBreakViewSet, basename='production-shift-breaks')
router.register(r'production/shift-occurrences', ProductionShiftOccurrenceViewSet, basename='production-shift-occurrences')
router.register(r'production/step-tablet-assignments', ProductionStepTabletAssignmentViewSet, basename='production-step-tablet-assignments')
router.register(r'production/device-maps', ProductionDevicePayloadMapViewSet, basename='production-device-maps')
router.register(r'production/data-fields', ProductionDataFieldViewSet, basename='production-data-fields')
router.register(r'production/routes', ProductionRouteViewSet, basename='production-routes')
router.register(r'production/rules', ProductionRuleSetViewSet, basename='production-rules')
router.register(r'production/rule-blocks', ProductionRuleBlockViewSet, basename='production-rule-blocks')
router.register(r'production/template-presets', ProductionTemplatePresetViewSet, basename='production-template-presets')
router.register(r'production/work-orders', ProductionWorkOrderViewSet, basename='production-work-orders')
router.register(r'production/sessions', ProductionWorkSessionViewSet, basename='production-sessions')
router.register(r'production/counting-windows', ProductionCountingWindowViewSet, basename='production-counting-windows')
router.register(r'production/events', ProductionEventViewSet, basename='production-events')
router.register(r'production/station-alerts', ProductionStationAlertViewSet, basename='production-station-alerts')
router.register(r'production/documents', ProductionDocumentViewSet, basename='production-documents')
router.register(r'tickets', TicketViewSet, basename='tickets')
router.register(r'ticket-messages', TicketMessageViewSet, basename='ticket-messages')
router.register(r'audit', AuditLogViewSet, basename='audit-logs')
router.register(r'approvals', ApprovalInstanceViewSet, basename='approvals')
router.register(r'tasks', TaskViewSet, basename='tasks')
router.register(r'task-attachments', TaskAttachmentViewSet, basename='task-attachments')
router.register(r'task-comments', TaskCommentViewSet, basename='task-comments')
router.register(r'task-checklist', TaskChecklistViewSet, basename='task-checklist')
router.register(r'task-models', TaskModelViewSet, basename='task-models')
router.register(r'automation-rules', AutomationRuleViewSet, basename='automation-rules')
router.register(r'task-time-entries', TaskTimeEntryViewSet, basename='task-time-entries')
router.register(r'task-workflow-templates', TaskWorkflowTemplateViewSet, basename='task-workflow-templates')
router.register(r'teams', TeamViewSet, basename='teams')
router.register(r'team-associates', TeamAssociateViewSet, basename='team-associates')
router.register(r'addons', AddonViewSet, basename='addons')
router.register(r'user-groups', UserGroupViewSet, basename='user-groups-public')

# NEW: Public APIs (no auth required)
router.register(r'v1/blog', PublicBlogViewSet, basename='public-blog')
router.register(r'v1/blog-categories', BlogCategoryViewSet, basename='blog-categories')

# NEW: Admin APIs (superadmin only)
router.register(r'v1/admin/blog', AdminBlogViewSet, basename='admin-blog')
router.register(r'v1/admin/contact', AdminContactViewSet, basename='admin-contact')
router.register(r'v1/admin/tenants', AdminTenantViewSet, basename='admin-tenants')
router.register(r'v1/admin/plans', AdminPlanViewSet, basename='admin-plans')
router.register(r'v1/admin/subscriptions', AdminSubscriptionViewSet, basename='admin-subscriptions')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/task-reports/summary/', TaskReportSummaryView.as_view(), name='task-report-summary'),
    path('api/task-reports/export/', TaskReportExportView.as_view(), name='task-report-export'),
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='docs'),
    path('api/auth/', include('accounts.urls')),
    path('api/addons/upload/', AddonUploadView.as_view(), name='addons-upload'),
    path('api/addons/navigation/', AddonNavigationView.as_view(), name='addons-navigation'),
    path('api/addons/navigation-items/', NavigationDesignerView.as_view(), name='addons-navigation-items'),
    path('api/addons/navigation-items/<int:pk>/', NavigationDesignerDetailView.as_view(), name='addons-navigation-item-detail'),
    path('api/addons/routes/', AddonRoutesView.as_view(), name='addons-routes'),
    path('api/addons/templates/', AddonTemplateView.as_view(), name='addons-templates'),
    path('api/addons/template-modifications/', AddonTemplateModificationView.as_view(), name='addons-template-modifications'),
    path('api/addons/compiled-templates/', AddonCompiledTemplateView.as_view(), name='addons-compiled-templates'),
    path('api/addons/phrases/', AddonPhraseView.as_view(), name='addons-phrases'),
    path('api/addons/style-assets/', AddonStyleAssetView.as_view(), name='addons-style-assets'),
    path('api/addons/styles.css', AddonStyleBundleView.as_view(), name='addons-style-bundle'),
    path('api/permissions/catalog/', PermissionCatalogView.as_view(), name='permissions-catalog'),
    path('api/phrases/', PhraseBundleView.as_view(), name='phrases'),
    path('api/user-groups/<int:pk>/permissions/', UserGroupPermissionView.as_view(), name='user-group-permissions'),
    # approvals/* sabit yollar router'dan ÖNCE olmalı; yoksa approvals/pending "pk=pending" sanılır
    path('api/approvals/pending/', PendingApprovalsView.as_view(), name='approvals-pending'),
    path('api/approvals/step/<int:pk>/action/', ApprovalActionView.as_view(), name='approval-action'),
    path('api/', include(router.urls)),
    path('api/dashboard/kpis/', DashboardKPIView.as_view(), name='dashboard-kpis'),
    path('api/warehouse-dashboard/', WarehouseDashboardView.as_view(), name='warehouse-dashboard'),
    path('api/production/settings/', ProductionSettingsView.as_view(), name='production-settings'),
    path('api/production/station-console/context/', ProductionStationConsoleView.as_view(), name='production-station-context'),
    path('api/production/station-console/event/', ProductionStationConsoleView.as_view(), name='production-station-event'),
    path('api/production/tablet/context/', ProductionTabletContextView.as_view(), name='production-tablet-context'),
    path('api/production/tablet/login-slot/', ProductionTabletLoginSlotView.as_view(), name='production-tablet-login-slot'),
    path('api/production/tablet/logout-slot/', ProductionTabletLogoutSlotView.as_view(), name='production-tablet-logout-slot'),
    path('api/production/tablet/batch-logout-slots/', ProductionTabletBatchLogoutSlotView.as_view(), name='production-tablet-batch-logout-slots'),
    path('api/production/tablet/break/start/', ProductionTabletBreakStartView.as_view(), name='production-tablet-break-start'),
    path('api/production/tablet/break/end/', ProductionTabletBreakEndView.as_view(), name='production-tablet-break-end'),
    path('api/production/tablet/checkpoint/', ProductionTabletCheckpointView.as_view(), name='production-tablet-checkpoint'),
    path('api/production/tablet/shift-checkpoint/', ProductionTabletShiftCheckpointView.as_view(), name='production-tablet-shift-checkpoint'),
    path('api/production/tablet/complete-work-item/', ProductionTabletCompleteWorkItemView.as_view(), name='production-tablet-complete-work-item'),
    path('api/production/tablet/call-manager/', ProductionTabletCallManagerView.as_view(), name='production-tablet-call-manager'),
    path('api/production/station-sessions/start/', ProductionSessionStartView.as_view(), name='production-session-start'),
    path('api/production/station-sessions/pause/', ProductionSessionPauseView.as_view(), name='production-session-pause'),
    path('api/production/station-sessions/resume/', ProductionSessionResumeView.as_view(), name='production-session-resume'),
    path('api/production/station-sessions/handover/', ProductionSessionHandoverView.as_view(), name='production-session-handover'),
    path('api/production/station-sessions/close/', ProductionSessionCloseView.as_view(), name='production-session-close'),
    path('api/production/station-sessions/<int:session_id>/review-discrepancy/', ProductionSessionReviewView.as_view(), name='production-session-review'),
    path('api/production/station-alerts/<int:alert_id>/ack/', ProductionStationAlertAckView.as_view(), name='production-station-alert-ack'),
    path('api/production/my-daily-sessions/', MyDailyProductionSessionsView.as_view(), name='production-my-daily-sessions'),
    path('api/production/pi/events/', ProductionPiEventView.as_view(), name='production-pi-events'),
    path('api/production/reports/summary/', ProductionReportSummaryView.as_view(), name='production-report-summary'),
    path('api/production/reports/shift-summary/', ProductionShiftReportSummaryView.as_view(), name='production-shift-report-summary'),
    path('api/production/reports/export/', ProductionReportExportView.as_view(), name='production-report-export'),
    path('api/search/', GlobalSearchView.as_view(), name='global-search'),
    path('api/uploads/presign/', UploadPresignView.as_view(), name='upload-presign'),
    path('api/calendar/ics/', CalendarICSView.as_view(), name='calendar-ics'),
    path('api/stream/', SSEView.as_view(), name='sse-stream'),
    path('api/health/', health, name='health'),
    # NEW: Contact form (public, rate limited)
    path('api/v1/contact/', contact_form_submit, name='contact-submit'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
