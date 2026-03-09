from rest_framework import serializers
from .models import BlogCategory, BlogPost


class BlogCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogCategory
        fields = ['id', 'name', 'slug', 'description']


class BlogPostListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for blog list"""
    author_name = serializers.CharField(source='author.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = BlogPost
        fields = [
            'id', 'title', 'slug', 'excerpt', 'featured_image',
            'author_name', 'category_name', 'published_at', 'views', 'tags'
        ]


class BlogPostDetailSerializer(serializers.ModelSerializer):
    """Full serializer for blog detail"""
    author_name = serializers.CharField(source='author.username', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = BlogPost
        fields = [
            'id', 'title', 'slug', 'excerpt', 'content', 'featured_image',
            'author_name', 'category', 'category_name', 'status',
            'published_at', 'created_at', 'updated_at', 'views', 'tags', 'meta_description'
        ]


class BlogPostAdminSerializer(serializers.ModelSerializer):
    """Admin serializer with all fields"""
    class Meta:
        model = BlogPost
        fields = '__all__'
        read_only_fields = ['views', 'created_at', 'updated_at']
