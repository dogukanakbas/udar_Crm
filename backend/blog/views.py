from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone

from .models import BlogCategory, BlogPost
from .serializers import (
    BlogCategorySerializer,
    BlogPostListSerializer,
    BlogPostDetailSerializer,
    BlogPostAdminSerializer
)
from core.permissions import IsSuperAdmin


class PublicBlogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public blog API - no authentication required.
    Only shows published posts.
    """
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category']
    search_fields = ['title', 'excerpt', 'content']
    ordering_fields = ['published_at', 'views']
    ordering = ['-published_at']
    lookup_field = 'slug'
    
    def get_queryset(self):
        return BlogPost.objects.filter(
            status='published',
            published_at__lte=timezone.now()
        ).select_related('author', 'category')
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return BlogPostDetailSerializer
        return BlogPostListSerializer
    
    def retrieve(self, request, *args, **kwargs):
        """Increment view count on detail view"""
        instance = self.get_object()
        instance.views += 1
        instance.save(update_fields=['views'])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)


class AdminBlogViewSet(viewsets.ModelViewSet):
    """
    Admin blog API - superadmin only.
    Full CRUD for blog posts.
    """
    permission_classes = [IsSuperAdmin]
    queryset = BlogPost.objects.all().select_related('author', 'category')
    serializer_class = BlogPostAdminSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'category', 'author']
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'published_at', 'views']
    ordering = ['-created_at']
    
    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        """Publish a draft post"""
        post = self.get_object()
        if post.status == 'published':
            return Response({'detail': 'Already published'}, status=status.HTTP_400_BAD_REQUEST)
        
        post.status = 'published'
        post.published_at = timezone.now()
        post.save()
        
        serializer = self.get_serializer(post)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        """Unpublish a post"""
        post = self.get_object()
        if post.status == 'draft':
            return Response({'detail': 'Already draft'}, status=status.HTTP_400_BAD_REQUEST)
        
        post.status = 'draft'
        post.save()
        
        serializer = self.get_serializer(post)
        return Response(serializer.data)


class BlogCategoryViewSet(viewsets.ReadOnlyModelViewSet):
    """Public blog categories"""
    permission_classes = [AllowAny]
    queryset = BlogCategory.objects.all()
    serializer_class = BlogCategorySerializer
    lookup_field = 'slug'
