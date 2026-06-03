from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    MeView,
    CreateUserView,
    BulkCreateUsersView,
    UsersListView,
    DeleteUserView,
    NotificationPrefView,
    RateLimitedTokenObtainPairView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    OTPSetupView,
    OTPEnableView,
    OTPDisableView,
    RolePermissionView,
    PermissionListView,
    UserGroupPermissionView,
    UserGroupViewSet,
    ChangePasswordView,
    InviteUserView,
    ActivateUserView,
    OrganizationSettingsView,
    OrganizationBrandingUploadView,
    BrandingAssetView,
    BrandingView,
)

router = DefaultRouter()
router.register(r'user-groups', UserGroupViewSet, basename='user-groups')

urlpatterns = [
    path('branding/', BrandingView.as_view(), name='branding'),
    path('branding-asset/<str:kind>/', BrandingAssetView.as_view(), name='branding_asset'),
    path('login/', RateLimitedTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('notification-prefs/', NotificationPrefView.as_view(), name='notification_prefs'),
    path('create-user/', CreateUserView.as_view(), name='create_user'),
    path('bulk-create-users/', BulkCreateUsersView.as_view(), name='bulk_create_users'),
    path('users/', UsersListView.as_view(), name='users_list'),
    path('users/<int:pk>/', DeleteUserView.as_view(), name='delete_user'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('otp/setup/', OTPSetupView.as_view(), name='otp_setup'),
    path('otp/enable/', OTPEnableView.as_view(), name='otp_enable'),
    path('otp/disable/', OTPDisableView.as_view(), name='otp_disable'),
    path('role-perms/', RolePermissionView.as_view(), name='role_perms'),
    path('permissions/', PermissionListView.as_view(), name='permissions'),
    path('user-groups/<int:pk>/permissions/', UserGroupPermissionView.as_view(), name='user_group_permissions'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('invite/', InviteUserView.as_view(), name='invite_user'),
    path('activate/', ActivateUserView.as_view(), name='activate_user'),
    path('organization-settings/', OrganizationSettingsView.as_view(), name='organization_settings'),
    path('organization-branding-upload/', OrganizationBrandingUploadView.as_view(), name='organization_branding_upload'),
] + router.urls
