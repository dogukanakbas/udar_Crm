# 🚀 UDAR CRM - PRODUCT WEBSITE PLANI

**Tarih**: 26 Şubat 2026  
**Durum**: Planlama Aşaması

---

## 🎯 PROJE AMACI

Udar CRM'i bir SaaS ürünü olarak pazarlamak için:
1. **Marketing Website** (udarsoft.com) - Ürünü tanıtan public site
2. **Customer Portal** (crm.udarsoft.com) - Mevcut CRM (dokunulmayacak)
3. **Admin Console** (admin.udarsoft.com) - Platform yönetimi

---

## 🏗️ MİMARİ

### Subdomain Yapısı

```
┌─────────────────────────────────────────────────────────────┐
│                     udarsoft.com                            │
│  (Marketing Website - Public)                               │
│  - Ana sayfa                                                │
│  - Özellikler                                               │
│  - Fiyatlandırma                                            │
│  - Blog                                                     │
│  - İletişim                                                 │
│  - Login                                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Login
                            ▼
                    ┌───────────────┐
                    │  Auth Gateway │
                    └───────────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
┌───────────────────────────┐  ┌──────────────────────────┐
│   crm.udarsoft.com        │  │  admin.udarsoft.com      │
│   (Customer CRM)          │  │  (Platform Admin)        │
│   - Mevcut sistem         │  │  - Tenant yönetimi       │
│   - Dokunulmayacak        │  │  - Blog yönetimi         │
│   - Tenant workspace      │  │  - İletişim formları     │
└───────────────────────────┘  └──────────────────────────┘
```

### Authentication Flow

```
1. User → udarsoft.com/login
2. POST /api/v1/auth/login
3. Backend checks role:
   - is_superadmin=true → redirect to admin.udarsoft.com
   - is_superadmin=false → redirect to crm.udarsoft.com
4. Cookie domain: .udarsoft.com (tüm subdomain'lerde geçerli)
```

---

## 📦 BACKEND DEĞİŞİKLİKLERİ

### Yeni Django Apps

```
backend/
├── platform/              # YENİ - Platform yönetimi
│   ├── models.py         # TenantPlan, TenantSubscription
│   ├── views.py          # Admin API'leri
│   └── serializers.py
├── blog/                  # YENİ - Blog sistemi
│   ├── models.py         # BlogPost, BlogCategory
│   ├── views.py          # Public + Admin API
│   └── serializers.py
├── contact/               # YENİ - İletişim formu
│   ├── models.py         # ContactSubmission
│   ├── views.py          # Public API
│   └── serializers.py
└── accounts/              # MEVCUT - Güncellenecek
    ├── models.py         # User.is_superadmin ekle
    └── views.py          # Login endpoint güncelle
```

### Yeni Models

#### 1. Platform App

```python
# backend/platform/models.py

class TenantPlan(models.Model):
    name = models.CharField(max_length=100)  # Starter, Professional, Enterprise
    price_monthly = models.DecimalField(max_digits=10, decimal_places=2)
    price_yearly = models.DecimalField(max_digits=10, decimal_places=2)
    max_users = models.IntegerField()
    max_storage_gb = models.IntegerField()
    features = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)

class TenantSubscription(models.Model):
    organization = models.OneToOneField('organizations.Organization')
    plan = models.ForeignKey(TenantPlan)
    status = models.CharField(choices=[
        ('trial', 'Trial'),
        ('active', 'Active'),
        ('suspended', 'Suspended'),
        ('cancelled', 'Cancelled'),
    ])
    trial_ends_at = models.DateTimeField(null=True)
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    billing_cycle = models.CharField(choices=[('monthly', 'Monthly'), ('yearly', 'Yearly')])
```

#### 2. Blog App

```python
# backend/blog/models.py

class BlogCategory(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

class BlogPost(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    excerpt = models.TextField()
    content = models.TextField()
    featured_image = models.URLField(blank=True)
    category = models.ForeignKey(BlogCategory, null=True)
    author = models.ForeignKey('accounts.User')
    status = models.CharField(choices=[
        ('draft', 'Draft'),
        ('published', 'Published'),
    ])
    published_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    views = models.IntegerField(default=0)
    tags = models.JSONField(default=list)
```

#### 3. Contact App

```python
# backend/contact/models.py

class ContactSubmission(models.Model):
    name = models.CharField(max_length=100)
    email = models.EmailField()
    company = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    message = models.TextField()
    status = models.CharField(choices=[
        ('new', 'New'),
        ('contacted', 'Contacted'),
        ('converted', 'Converted'),
        ('closed', 'Closed'),
    ])
    created_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True)
```

### Yeni API Endpoints

```python
# Public APIs (no auth required)
GET  /api/v1/blog/                    # Blog listesi
GET  /api/v1/blog/:slug/              # Blog detay
POST /api/v1/contact/                 # İletişim formu

# Auth APIs
POST /api/v1/auth/login/              # Login (role-based redirect)
GET  /api/v1/auth/me/                 # Current user + is_superadmin

# Superadmin APIs (is_superadmin=true required)
GET    /api/v1/admin/tenants/         # Tenant listesi
POST   /api/v1/admin/tenants/         # Yeni tenant
GET    /api/v1/admin/tenants/:id/     # Tenant detay
PATCH  /api/v1/admin/tenants/:id/     # Tenant güncelle
DELETE /api/v1/admin/tenants/:id/     # Tenant sil

GET    /api/v1/admin/blog/            # Blog listesi (admin)
POST   /api/v1/admin/blog/            # Yeni blog
PATCH  /api/v1/admin/blog/:id/        # Blog güncelle
DELETE /api/v1/admin/blog/:id/        # Blog sil

GET    /api/v1/admin/contact/         # İletişim formları
PATCH  /api/v1/admin/contact/:id/     # Durum güncelle
```

### User Model Güncelleme

```python
# backend/accounts/models.py

class User(AbstractUser):
    # ... mevcut alanlar ...
    is_superadmin = models.BooleanField(default=False)  # YENİ
```

---

## 🎨 FRONTEND DEĞİŞİKLİKLERİ

### Yeni Frontend Projesi (Marketing Website)

```
frontend-public/           # YENİ PROJE
├── src/
│   ├── pages/
│   │   ├── home.tsx              # Ana sayfa
│   │   ├── features.tsx          # Özellikler
│   │   ├── how-it-works.tsx      # Nasıl çalışır
│   │   ├── security.tsx          # Güvenlik
│   │   ├── pricing.tsx           # Fiyatlandırma
│   │   ├── blog/
│   │   │   ├── index.tsx         # Blog listesi
│   │   │   └── [slug].tsx        # Blog detay
│   │   ├── contact.tsx           # İletişim
│   │   └── login.tsx             # Login (auth gateway)
│   ├── components/
│   │   ├── public-header.tsx     # Public header
│   │   ├── public-footer.tsx     # Footer
│   │   └── hero.tsx              # Hero section
│   └── lib/
│       └── api.ts                # Public API client
└── package.json
```

### Yeni Frontend Projesi (Admin Console)

```
frontend-admin/            # YENİ PROJE
├── src/
│   ├── pages/
│   │   ├── dashboard.tsx         # Admin dashboard
│   │   ├── tenants/
│   │   │   ├── index.tsx         # Tenant listesi
│   │   │   └── [id].tsx          # Tenant detay
│   │   ├── blog/
│   │   │   ├── index.tsx         # Blog yönetimi
│   │   │   └── editor.tsx        # Blog editor
│   │   └── contact.tsx           # İletişim formları
│   ├── components/
│   │   ├── admin-sidebar.tsx     # Admin sidebar
│   │   └── admin-header.tsx      # Admin header
│   └── lib/
│       └── api.ts                # Admin API client
└── package.json
```

### Mevcut Frontend (CRM)

```
frontend/                  # MEVCUT - DOKUNULMAYACAK
├── src/
│   └── ... (mevcut CRM kodu)
```

---

## 🔐 GÜVENLİK

### Cookie Configuration

```python
# backend/core/settings.py

# Session cookies
SESSION_COOKIE_DOMAIN = '.udarsoft.com'  # Tüm subdomain'lerde geçerli
SESSION_COOKIE_SECURE = True             # HTTPS only
SESSION_COOKIE_HTTPONLY = True           # XSS koruması
SESSION_COOKIE_SAMESITE = 'Lax'          # CSRF koruması

# CSRF cookies
CSRF_COOKIE_DOMAIN = '.udarsoft.com'
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = [
    'https://udarsoft.com',
    'https://crm.udarsoft.com',
    'https://admin.udarsoft.com',
]
```

### Rate Limiting

```python
# İletişim formu: 5 request / 10 dakika
# Blog API: 100 request / dakika
# Admin API: 1000 request / dakika
```

### Permissions

```python
# Superadmin check
class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superadmin

# Tenant isolation
class IsTenantMember(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.organization == view.get_object().organization
```

---

## 📝 MARKETING WEBSITE İÇERİĞİ

### 1. Ana Sayfa (Home)

**Hero Section**:
```
Başlık: Modern CRM + ERP Çözümü
Alt başlık: Satış, operasyon ve finans süreçlerinizi tek platformda yönetin
CTA: Demo Talep Et | Giriş Yap
```

**Features Grid**:
- CRM: Lead, fırsat, teklif yönetimi
- Operasyon: Görev, proje, ekip takibi
- Finans: Fatura, ödeme, muhasebe
- Destek: Ticket, SLA, otomasyon

**Social Proof**:
- Müşteri logoları
- Testimonials
- İstatistikler

### 2. Özellikler (Features)

**CRM**:
- Lead yönetimi
- Fırsat takibi
- Teklif oluşturma
- Onay süreçleri

**Operasyon**:
- Görev yönetimi
- Proje planlama
- Ekip işbirliği
- Zaman takibi

**Finans**:
- Fatura oluşturma
- Ödeme takibi
- Stok yönetimi
- Raporlama

**Destek**:
- Ticket sistemi
- SLA yönetimi
- Otomasyon kuralları
- Bildirimler

### 3. Güvenlik (Security)

- Tenant izolasyonu
- RBAC (Role-based access control)
- Audit logs
- 2FA
- HTTPS
- Data encryption

### 4. Fiyatlandırma (Pricing)

**Starter**: $29/ay
- 5 kullanıcı
- 10 GB depolama
- Temel özellikler

**Professional**: $99/ay
- 20 kullanıcı
- 50 GB depolama
- Tüm özellikler
- API erişimi

**Enterprise**: Custom
- Sınırsız kullanıcı
- Sınırsız depolama
- Özel entegrasyonlar
- Dedicated support

---

## 🚀 DEPLOYMENT PLANI

### Nginx Configuration

```nginx
# udarsoft.com (marketing website)
server {
    server_name udarsoft.com;
    root /var/www/frontend-public/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend:8000;
    }
}

# crm.udarsoft.com (existing CRM)
server {
    server_name crm.udarsoft.com;
    root /var/www/frontend/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend:8000;
    }
}

# admin.udarsoft.com (admin console)
server {
    server_name admin.udarsoft.com;
    root /var/www/frontend-admin/dist;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://backend:8000;
    }
}
```

### Docker Compose

```yaml
services:
  backend:
    # ... mevcut config ...
  
  frontend-public:
    build: ./frontend-public
    volumes:
      - ./frontend-public/dist:/var/www/frontend-public/dist
  
  frontend-admin:
    build: ./frontend-admin
    volumes:
      - ./frontend-admin/dist:/var/www/frontend-admin/dist
  
  frontend:
    # ... mevcut CRM frontend ...
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Backend Foundation (1-2 gün)
- [ ] User model'e `is_superadmin` ekle
- [ ] Platform app oluştur (TenantPlan, TenantSubscription)
- [ ] Blog app oluştur (BlogPost, BlogCategory)
- [ ] Contact app oluştur (ContactSubmission)
- [ ] Public API endpoints (/api/v1/blog, /api/v1/contact)
- [ ] Admin API endpoints (/api/v1/admin/*)
- [ ] Auth endpoint güncelle (role-based redirect)
- [ ] Permissions (IsSuperAdmin, IsTenantMember)
- [ ] Rate limiting
- [ ] Migrations

### Phase 2: Marketing Website (2-3 gün)
- [ ] Yeni React projesi (frontend-public)
- [ ] Public layout (header, footer)
- [ ] Ana sayfa (hero, features, CTA)
- [ ] Özellikler sayfası
- [ ] Nasıl çalışır sayfası
- [ ] Güvenlik sayfası
- [ ] Fiyatlandırma sayfası
- [ ] Blog listesi
- [ ] Blog detay
- [ ] İletişim formu
- [ ] Login sayfası (auth gateway)

### Phase 3: Admin Console (2-3 gün)
- [ ] Yeni React projesi (frontend-admin)
- [ ] Admin layout (sidebar, header)
- [ ] Dashboard
- [ ] Tenant yönetimi (list, detail, create, edit)
- [ ] Blog yönetimi (list, create, edit, publish)
- [ ] İletişim formları (list, status update)
- [ ] Admin user yönetimi

### Phase 4: Integration & Testing (1-2 gün)
- [ ] Cookie domain configuration
- [ ] Auth flow test (login → redirect)
- [ ] Tenant isolation test
- [ ] Permission test
- [ ] Rate limiting test
- [ ] Cross-subdomain auth test

### Phase 5: Content & Deployment (1 gün)
- [ ] Seed data (1 superadmin, 1 tenant, 5 blog posts)
- [ ] Marketing content yazma
- [ ] Blog posts yazma
- [ ] Nginx configuration
- [ ] SSL certificates (udarsoft.com, *.udarsoft.com)
- [ ] DNS configuration
- [ ] Production deployment

---

## 🎯 TOPLAM SÜRE TAHMİNİ

- Backend: 1-2 gün
- Marketing Website: 2-3 gün
- Admin Console: 2-3 gün
- Integration & Testing: 1-2 gün
- Content & Deployment: 1 gün

**Toplam**: 7-11 gün (1.5-2 hafta)

---

## 📞 SONRAKI ADIMLAR

1. **Onay**: Bu planı onayla
2. **Başla**: Phase 1'den başla (Backend Foundation)
3. **İlerleme**: Her phase'i tamamla ve test et
4. **Deploy**: Production'a al

Başlamak için hazır mısın?

---

**Hazırlayan**: Kiro AI  
**Tarih**: 26 Şubat 2026  
**Durum**: Planlama Tamamlandı 🚀
