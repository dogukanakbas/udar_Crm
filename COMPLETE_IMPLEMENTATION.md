# 🚀 UDAR CRM PRODUCT WEBSITE - COMPLETE IMPLEMENTATION

**Tarih**: 1 Mart 2026  
**Durum**: Tam Implementation Rehberi

---

## 📋 GENEL BAKIŞ

Bu dokümanda 3 projeyi tamamlayacağız:
1. **frontend-public** - Marketing website (udarsoft.com)
2. **frontend-admin** - Admin console (admin.udarsoft.com)  
3. **frontend** - Mevcut CRM (crm.udarsoft.com) - Dokunulmayacak

---

## 🎨 PHASE 2: MARKETING WEBSITE (frontend-public)

### Adım 1: Proje Oluştur

```bash
# Ana dizinde
npm create vite@latest frontend-public -- --template react-ts
cd frontend-public

# Dependencies
npm install @tanstack/react-router axios lucide-react
npm install react-hook-form zod @hookform/resolvers
npm install class-variance-authority clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui
npx shadcn-ui@latest init
# Seçenekler: Default, Slate, Yes (CSS variables)

# Components
npx shadcn-ui@latest add button card input textarea badge separator toast
```

### Adım 2: Tailwind Config

```typescript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### Adım 3: Dosya Yapısı

```
frontend-public/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── footer.tsx
│   │   │   └── page-wrapper.tsx
│   │   ├── sections/
│   │   │   ├── hero.tsx
│   │   │   ├── features-grid.tsx
│   │   │   ├── pricing-cards.tsx
│   │   │   └── cta-section.tsx
│   │   └── ui/              # shadcn/ui
│   ├── pages/
│   │   ├── home.tsx
│   │   ├── features.tsx
│   │   ├── pricing.tsx
│   │   ├── security.tsx
│   │   ├── blog/
│   │   │   ├── index.tsx
│   │   │   └── detail.tsx
│   │   ├── contact.tsx
│   │   └── login.tsx
│   ├── lib/
│   │   ├── api.ts
│   │   └── utils.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── .env
└── package.json
```

### Adım 4: Core Files

**src/lib/api.ts**:
```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
```

**src/types/index.ts**:
```typescript
export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  featured_image: string
  author_name: string
  category_name: string
  published_at: string
  views: number
  tags: string[]
}

export interface Plan {
  id: string
  name: string
  slug: string
  price_monthly: number
  price_yearly: number
  max_users: number
  features: string[]
}
```

**.env**:
```bash
VITE_API_BASE_URL=http://localhost:8000/api
```

### Adım 5: Router Setup

**src/main.tsx**:
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router'
import './index.css'

import { HomePage } from './pages/home'
import { FeaturesPage } from './pages/features'
import { PricingPage } from './pages/pricing'
import { BlogListPage } from './pages/blog/index'
import { BlogDetailPage } from './pages/blog/detail'
import { ContactPage } from './pages/contact'
import { LoginPage } from './pages/login'
import { PageWrapper } from './components/layout/page-wrapper'

const rootRoute = createRootRoute({
  component: PageWrapper,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const featuresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features',
  component: FeaturesPage,
})

const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pricing',
  component: PricingPage,
})

const blogRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog',
  component: BlogListPage,
})

const blogDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/$slug',
  component: BlogDetailPage,
})

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contact',
  component: ContactPage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  featuresRoute,
  pricingRoute,
  blogRoute,
  blogDetailRoute,
  contactRoute,
  loginRoute,
])

const router = createRouter({ routeTree })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
```

### Adım 6: Tüm Sayfalar

Tüm sayfa kodları `PHASE_2_IMPLEMENTATION_GUIDE.md` dosyasında mevcut. Oradan kopyala.

### Adım 7: Build & Test

```bash
npm run dev
# http://localhost:5173

npm run build
# dist/ klasörü oluşur
```

---

## 🔐 PHASE 3: ADMIN CONSOLE (frontend-admin)

### Adım 1: Proje Oluştur

```bash
# Ana dizinde
npm create vite@latest frontend-admin -- --template react-ts
cd frontend-admin

# Dependencies (aynı)
npm install @tanstack/react-router axios lucide-react
npm install react-hook-form zod @hookform/resolvers
npm install class-variance-authority clsx tailwind-merge
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# shadcn/ui
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea badge table dialog select
```

### Adım 2: Dosya Yapısı

```
frontend-admin/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── admin-sidebar.tsx
│   │   │   ├── admin-header.tsx
│   │   │   └── admin-wrapper.tsx
│   │   └── ui/
│   ├── pages/
│   │   ├── dashboard.tsx
│   │   ├── tenants/
│   │   │   ├── index.tsx
│   │   │   └── detail.tsx
│   │   ├── blog/
│   │   │   ├── index.tsx
│   │   │   └── editor.tsx
│   │   ├── contact.tsx
│   │   └── login.tsx
│   ├── lib/
│   │   └── api.ts
│   └── main.tsx
└── package.json
```

### Adım 3: Admin Sidebar

**src/components/layout/admin-sidebar.tsx**:
```typescript
import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Building2, FileText, Mail, Users } from 'lucide-react'

export function AdminSidebar() {
  return (
    <aside className="w-64 border-r bg-muted/40 p-6">
      <div className="mb-8">
        <h2 className="text-xl font-bold">Udar Admin</h2>
      </div>
      <nav className="space-y-2">
        <Link 
          to="/dashboard" 
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent"
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </Link>
        <Link 
          to="/tenants" 
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent"
        >
          <Building2 className="h-5 w-5" />
          Tenants
        </Link>
        <Link 
          to="/blog" 
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent"
        >
          <FileText className="h-5 w-5" />
          Blog
        </Link>
        <Link 
          to="/contact" 
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent"
        >
          <Mail className="h-5 w-5" />
          Contact
        </Link>
      </nav>
    </aside>
  )
}
```

### Adım 4: Admin Pages

**Dashboard**:
```typescript
// src/pages/dashboard.tsx
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import api from '@/lib/api'

export function DashboardPage() {
  const [stats, setStats] = useState({
    tenants: 0,
    posts: 0,
    contacts: 0,
  })

  useEffect(() => {
    Promise.all([
      api.get('/v1/admin/tenants/'),
      api.get('/v1/admin/blog/'),
      api.get('/v1/admin/contact/'),
    ]).then(([tenants, posts, contacts]) => {
      setStats({
        tenants: tenants.data.length,
        posts: posts.data.length,
        contacts: contacts.data.length,
      })
    })
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Tenants</h3>
          <p className="text-3xl font-bold mt-2">{stats.tenants}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Blog Posts</h3>
          <p className="text-3xl font-bold mt-2">{stats.posts}</p>
        </Card>
        <Card className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground">Contact Submissions</h3>
          <p className="text-3xl font-bold mt-2">{stats.contacts}</p>
        </Card>
      </div>
    </div>
  )
}
```

**Tenant List**:
```typescript
// src/pages/tenants/index.tsx
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'

export function TenantsPage() {
  const [tenants, setTenants] = useState([])

  useEffect(() => {
    api.get('/v1/admin/tenants/').then(res => setTenants(res.data))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tenants</h1>
        <Button>Add Tenant</Button>
      </div>
      <div className="grid gap-4">
        {tenants.map((tenant: any) => (
          <Card key={tenant.id} className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">{tenant.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {tenant.user_count} users
                </p>
              </div>
              <Link to={`/tenants/${tenant.id}`}>
                <Button variant="outline">View</Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

**Blog Management**:
```typescript
// src/pages/blog/index.tsx
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'

export function BlogManagementPage() {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    api.get('/v1/admin/blog/').then(res => setPosts(res.data))
  }, [])

  const handlePublish = async (id: string) => {
    await api.post(`/v1/admin/blog/${id}/publish/`)
    // Refresh
    api.get('/v1/admin/blog/').then(res => setPosts(res.data))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Blog Management</h1>
        <Link to="/blog/new">
          <Button>New Post</Button>
        </Link>
      </div>
      <div className="space-y-4">
        {posts.map((post: any) => (
          <div key={post.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold">{post.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {post.excerpt}
                </p>
                <div className="mt-2">
                  <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                    {post.status}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/blog/${post.id}/edit`}>
                  <Button variant="outline" size="sm">Edit</Button>
                </Link>
                {post.status === 'draft' && (
                  <Button size="sm" onClick={() => handlePublish(post.id)}>
                    Publish
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 🔗 PHASE 4: INTEGRATION

### Cookie Configuration

**backend/core/settings.py**:
```python
# Session cookies (cross-subdomain)
SESSION_COOKIE_DOMAIN = '.udarsoft.com'
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

# CSRF cookies
CSRF_COOKIE_DOMAIN = '.udarsoft.com'
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = [
    'https://udarsoft.com',
    'https://crm.udarsoft.com',
    'https://admin.udarsoft.com',
]

# CORS
CORS_ALLOWED_ORIGINS = [
    'https://udarsoft.com',
    'https://crm.udarsoft.com',
    'https://admin.udarsoft.com',
]
CORS_ALLOW_CREDENTIALS = True
```

---

## 🚀 PHASE 5: DEPLOYMENT

### Docker Compose Update

**docker-compose.prod.yml**:
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    environment:
      - DJANGO_SECRET_KEY=${DJANGO_SECRET_KEY}
      - DJANGO_DEBUG=False
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_HOST=db
      - ALLOWED_HOSTS=crm.udarsoft.com
      - CORS_ALLOWED_ORIGINS=https://udarsoft.com,https://crm.udarsoft.com,https://admin.udarsoft.com
      - CSRF_TRUSTED_ORIGINS=https://udarsoft.com,https://crm.udarsoft.com,https://admin.udarsoft.com
      - SESSION_COOKIE_DOMAIN=.udarsoft.com
      - CSRF_COOKIE_DOMAIN=.udarsoft.com
    depends_on:
      - db
      - redis

  frontend-public:
    build: ./frontend-public
    volumes:
      - ./frontend-public/dist:/usr/share/nginx/html

  frontend-admin:
    build: ./frontend-admin
    volumes:
      - ./frontend-admin/dist:/usr/share/nginx/html

  frontend:
    build: ./frontend
    volumes:
      - ./frontend/dist:/usr/share/nginx/html

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend-public
      - frontend-admin
      - frontend

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7

volumes:
  postgres_data:
```

### Nginx Configuration

**nginx/nginx.conf**:
```nginx
http {
    # udarsoft.com (marketing website)
    server {
        listen 80;
        listen 443 ssl;
        server_name udarsoft.com;

        ssl_certificate /etc/nginx/ssl/udarsoft.com.crt;
        ssl_certificate_key /etc/nginx/ssl/udarsoft.com.key;

        root /var/www/frontend-public/dist;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    # crm.udarsoft.com (CRM app)
    server {
        listen 80;
        listen 443 ssl;
        server_name crm.udarsoft.com;

        ssl_certificate /etc/nginx/ssl/udarsoft.com.crt;
        ssl_certificate_key /etc/nginx/ssl/udarsoft.com.key;

        root /var/www/frontend/dist;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }

    # admin.udarsoft.com (Admin console)
    server {
        listen 80;
        listen 443 ssl;
        server_name admin.udarsoft.com;

        ssl_certificate /etc/nginx/ssl/udarsoft.com.crt;
        ssl_certificate_key /etc/nginx/ssl/udarsoft.com.key;

        root /var/www/frontend-admin/dist;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://backend:8000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

### SSL Certificate

```bash
# Let's Encrypt
certbot certonly --nginx -d udarsoft.com -d *.udarsoft.com
```

### DNS Configuration

```
A     udarsoft.com          → YOUR_SERVER_IP
A     crm.udarsoft.com      → YOUR_SERVER_IP
A     admin.udarsoft.com    → YOUR_SERVER_IP
```

### Deployment Commands

```bash
# 1. Build frontend projects
cd frontend-public && npm run build
cd ../frontend-admin && npm run build
cd ../frontend && npm run build

# 2. Deploy
cd ..
docker compose -f docker-compose.prod.yml up -d --build

# 3. Run migrations
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# 4. Seed data
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_product_website
```

---

## ✅ FINAL CHECKLIST

### Backend
- [x] User.is_superadmin field
- [x] Tenants app (TenantPlan, TenantSubscription)
- [x] Blog app (BlogPost, BlogCategory)
- [x] Contact app (ContactSubmission)
- [x] Public APIs (blog, contact)
- [x] Admin APIs (blog, tenants, contact)
- [x] Permissions (IsSuperAdmin)
- [x] Seed data
- [ ] Cookie configuration (SESSION_COOKIE_DOMAIN)
- [ ] CORS configuration

### Frontend Public
- [ ] Project setup
- [ ] Layout (header, footer)
- [ ] Home page
- [ ] Features page
- [ ] Pricing page
- [ ] Security page
- [ ] Blog list
- [ ] Blog detail
- [ ] Contact form
- [ ] Login (auth gateway)

### Frontend Admin
- [ ] Project setup
- [ ] Admin layout (sidebar, header)
- [ ] Dashboard
- [ ] Tenant management
- [ ] Blog management
- [ ] Contact submissions
- [ ] Login

### Deployment
- [ ] Docker compose update
- [ ] Nginx configuration
- [ ] SSL certificates
- [ ] DNS configuration
- [ ] Build & deploy

---

## 🎯 HIZLI BAŞLANGIÇ

```bash
# 1. Marketing Website
npm create vite@latest frontend-public -- --template react-ts
cd frontend-public
npm install
# Yukarıdaki kodları kopyala

# 2. Admin Console
npm create vite@latest frontend-admin -- --template react-ts
cd frontend-admin
npm install
# Yukarıdaki kodları kopyala

# 3. Backend Config
# backend/core/settings.py'yi güncelle (cookie domain)

# 4. Deploy
docker compose -f docker-compose.prod.yml up -d --build
```

---

**Hazırlayan**: Kiro AI  
**Tarih**: 1 Mart 2026  
**Durum**: Complete Implementation Guide 🚀
