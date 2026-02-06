from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    MeView,
    CreateUserView,
    UsersListView,
    NotificationPrefView,
    RateLimitedTokenObtainPairView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    OTPSetupView,
    OTPEnableView,
    OTPDisableView,
    RolePermissionView,
    PermissionListView,
    ChangePasswordView,
    InviteUserView,
    ActivateUserView,
)

urlpatterns = [
    path('login/', RateLimitedTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('notification-prefs/', NotificationPrefView.as_view(), name='notification_prefs'),
    path('create-user/', CreateUserView.as_view(), name='create_user'),
    path('users/', UsersListView.as_view(), name='users_list'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('otp/setup/', OTPSetupView.as_view(), name='otp_setup'),
    path('otp/enable/', OTPEnableView.as_view(), name='otp_enable'),
    path('otp/disable/', OTPDisableView.as_view(), name='otp_disable'),
    path('role-perms/', RolePermissionView.as_view(), name='role_perms'),
    path('permissions/', PermissionListView.as_view(), name='permissions'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('invite/', InviteUserView.as_view(), name='invite_user'),
    path('activate/', ActivateUserView.as_view(), name='activate_user'),
]

