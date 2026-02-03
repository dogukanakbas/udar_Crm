from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import MeView, CreateUserView, UsersListView, NotificationPrefView

urlpatterns = [
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('notification-prefs/', NotificationPrefView.as_view(), name='notification_prefs'),
    path('create-user/', CreateUserView.as_view(), name='create_user'),
    path('users/', UsersListView.as_view(), name='users_list'),
]

