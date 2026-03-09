from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from organizations.models import Organization, Branch
from tenants.models import TenantPlan, TenantSubscription
from blog.models import BlogCategory, BlogPost
from contact.models import ContactSubmission

User = get_user_model()


class Command(BaseCommand):
    help = "Seed product website data: superadmin, plans, blog posts"

    def handle(self, *args, **options):
        self.stdout.write("Seeding product website data...")
        
        # 1. Create superadmin
        superadmin, created = User.objects.get_or_create(
            username='superadmin@udarsoft.com',
            defaults={
                'email': 'superadmin@udarsoft.com',
                'is_superadmin': True,
                'is_staff': True,
                'is_superuser': True,
            }
        )
        if created:
            superadmin.set_password('SuperAdmin123!')
            superadmin.save()
            self.stdout.write(self.style.SUCCESS(f'✓ Created superadmin: {superadmin.username}'))
        else:
            self.stdout.write(f'  Superadmin already exists: {superadmin.username}')
        
        # 2. Create subscription plans
        plans_data = [
            {
                'name': 'Starter',
                'slug': 'starter',
                'plan_type': 'starter',
                'description': 'Perfect for small teams getting started',
                'price_monthly': Decimal('29.00'),
                'price_yearly': Decimal('290.00'),
                'max_users': 5,
                'max_storage_gb': 10,
                'features': ['crm', 'tasks', 'basic_reports'],
            },
            {
                'name': 'Professional',
                'slug': 'professional',
                'plan_type': 'professional',
                'description': 'For growing businesses',
                'price_monthly': Decimal('99.00'),
                'price_yearly': Decimal('990.00'),
                'max_users': 20,
                'max_storage_gb': 50,
                'features': ['crm', 'erp', 'tasks', 'advanced_reports', 'api_access'],
            },
            {
                'name': 'Enterprise',
                'slug': 'enterprise',
                'plan_type': 'enterprise',
                'description': 'Custom solution for large organizations',
                'price_monthly': Decimal('299.00'),
                'price_yearly': Decimal('2990.00'),
                'max_users': 999,
                'max_storage_gb': 500,
                'features': ['all_features', 'dedicated_support', 'custom_integrations'],
            },
        ]
        
        for plan_data in plans_data:
            plan, created = TenantPlan.objects.get_or_create(
                slug=plan_data['slug'],
                defaults=plan_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Created plan: {plan.name}'))
        
        # 3. Create blog categories
        categories_data = [
            {'name': 'Product Updates', 'slug': 'product-updates'},
            {'name': 'Best Practices', 'slug': 'best-practices'},
            {'name': 'Customer Stories', 'slug': 'customer-stories'},
        ]
        
        for cat_data in categories_data:
            cat, created = BlogCategory.objects.get_or_create(
                slug=cat_data['slug'],
                defaults=cat_data
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Created category: {cat.name}'))
        
        # 4. Create blog posts
        category = BlogCategory.objects.first()
        
        posts_data = [
            {
                'title': 'Udar CRM ile Satış Süreçlerinizi Optimize Edin',
                'slug': 'udar-crm-ile-satis-sureclerinizi-optimize-edin',
                'excerpt': 'Modern CRM çözümü ile satış ekibinizin verimliliğini artırın.',
                'content': '''# Udar CRM ile Satış Süreçlerinizi Optimize Edin

Satış süreçlerinizi dijitalleştirmek ve optimize etmek için Udar CRM'in sunduğu özellikleri keşfedin.

## Lead Yönetimi
- Otomatik lead puanlama
- Lead kaynak takibi
- Dönüşüm hunisi analizi

## Fırsat Takibi
- Pipeline görünümü
- Tahmin raporları
- Aktivite geçmişi

Daha fazla bilgi için demo talep edin!''',
                'tags': ['crm', 'sales', 'optimization'],
            },
            {
                'title': 'ERP Entegrasyonu ile İş Süreçlerinizi Birleştirin',
                'slug': 'erp-entegrasyonu-ile-is-sureclerinizi-birlestirin',
                'excerpt': 'CRM ve ERP entegrasyonu ile tüm iş süreçlerinizi tek platformda yönetin.',
                'content': '''# ERP Entegrasyonu

Udar CRM'in ERP modülü ile stok, fatura ve muhasebe süreçlerinizi entegre edin.

## Özellikler
- Stok yönetimi
- Fatura oluşturma
- Muhasebe entegrasyonu
- Raporlama''',
                'tags': ['erp', 'integration', 'automation'],
            },
            {
                'title': 'Görev Yönetimi ile Ekip Verimliliğini Artırın',
                'slug': 'gorev-yonetimi-ile-ekip-verimliligini-artirin',
                'excerpt': 'Kanban board ve görev takibi ile ekibinizin verimliliğini maksimize edin.',
                'content': '''# Görev Yönetimi

Udar CRM'in görev yönetimi modülü ile projelerinizi ve ekibinizi verimli yönetin.

## Özellikler
- Kanban board
- Zaman takibi
- Ekip işbirliği
- SLA yönetimi''',
                'tags': ['tasks', 'productivity', 'collaboration'],
            },
            {
                'title': 'Güvenlik ve Veri Koruma',
                'slug': 'guvenlik-ve-veri-koruma',
                'excerpt': 'Udar CRM ile verileriniz güvende. Tenant izolasyonu ve RBAC ile maksimum güvenlik.',
                'content': '''# Güvenlik

Udar CRM, verilerinizin güvenliğini en üst düzeyde tutar.

## Güvenlik Özellikleri
- Tenant izolasyonu
- RBAC (Role-based access control)
- Audit logs
- 2FA
- HTTPS
- Data encryption''',
                'tags': ['security', 'compliance', 'data-protection'],
            },
            {
                'title': 'Raporlama ve Analitik',
                'slug': 'raporlama-ve-analitik',
                'excerpt': 'Gelişmiş raporlama araçları ile iş süreçlerinizi analiz edin.',
                'content': '''# Raporlama

Udar CRM'in güçlü raporlama modülü ile verilerinizi analiz edin.

## Rapor Türleri
- Satış raporları
- Performans raporları
- Finansal raporlar
- Özel raporlar''',
                'tags': ['reporting', 'analytics', 'insights'],
            },
        ]
        
        for post_data in posts_data:
            post, created = BlogPost.objects.get_or_create(
                slug=post_data['slug'],
                defaults={
                    **post_data,
                    'author': superadmin,
                    'category': category,
                    'status': 'published',
                    'published_at': timezone.now() - timedelta(days=len(posts_data)),
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Created blog post: {post.title}'))
        
        self.stdout.write(self.style.SUCCESS('\n✅ Product website data seeded successfully!'))
        self.stdout.write(f'\nSuperadmin credentials:')
        self.stdout.write(f'  Email: superadmin@udarsoft.com')
        self.stdout.write(f'  Password: SuperAdmin123!')
