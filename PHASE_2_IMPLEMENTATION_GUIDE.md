# 🎨 PHASE 2: MARKETING WEBSITE - IMPLEMENTATION GUIDE

**Tarih**: 1 Mart 2026  
**Durum**: Implementation Guide

---

## 🚀 HIZLI BAŞLANGIÇ

### 1. Proje Oluştur

```bash
# Yeni React + TypeScript projesi
npm create vite@latest frontend-public -- --template react-ts

cd frontend-public

# Dependencies
npm install

# Router
npm install @tanstack/react-router

# API client
npm install axios

# Icons
npm install lucide-react

# Form validation
npm install react-hook-form zod @hookform/resolvers

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 2. shadcn/ui Setup

```bash
# shadcn/ui init
npx shadcn-ui@latest init

# Seçenekler:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes

# Components ekle
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add toast
```

### 3. Tailwind Config

```typescript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
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

---

## 📁 PROJE YAPISI

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
│   │   │   ├── how-it-works.tsx
│   │   │   └── cta-section.tsx
│   │   └── ui/              # shadcn/ui components
│   ├── pages/
│   │   ├── home.tsx
│   │   ├── features.tsx
│   │   ├── pricing.tsx
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
├── public/
├── .env
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🔧 CORE FILES

### 1. API Client

```typescript
// src/lib/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor (add auth token if exists)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
```

### 2. Types

```typescript
// src/types/index.ts
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

export interface BlogCategory {
  id: string
  name: string
  slug: string
  description: string
}

export interface ContactForm {
  name: string
  email: string
  company?: string
  phone?: string
  message: string
}

export interface Plan {
  id: string
  name: string
  slug: string
  plan_type: 'starter' | 'professional' | 'enterprise'
  description: string
  price_monthly: number
  price_yearly: number
  max_users: number
  max_storage_gb: number
  features: string[]
}
```

### 3. Environment Variables

```bash
# .env
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## 🎨 LAYOUT COMPONENTS

### Header

```typescript
// src/components/layout/header.tsx
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link to="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-xl">Udar CRM</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link to="/features">Özellikler</Link>
            <Link to="/pricing">Fiyatlandırma</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/contact">İletişim</Link>
          </nav>
        </div>
        <div className="ml-auto flex items-center space-x-4">
          <Link to="/login">
            <Button variant="ghost">Giriş Yap</Button>
          </Link>
          <Link to="/contact">
            <Button>Demo Talep Et</Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
```

### Footer

```typescript
// src/components/layout/footer.tsx
import { Link } from '@tanstack/react-router'

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h3 className="font-bold text-lg mb-4">Udar CRM</h3>
            <p className="text-sm text-muted-foreground">
              Modern CRM + ERP çözümü
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Ürün</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/features">Özellikler</Link></li>
              <li><Link to="/pricing">Fiyatlandırma</Link></li>
              <li><Link to="/security">Güvenlik</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Şirket</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/about">Hakkımızda</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/contact">İletişim</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Yasal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy">Gizlilik</Link></li>
              <li><Link to="/terms">Kullanım Koşulları</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          © 2026 Udar CRM. Tüm hakları saklıdır.
        </div>
      </div>
    </footer>
  )
}
```

---

## 📄 KEY PAGES

### Home Page

```typescript
// src/pages/home.tsx
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, BarChart, Users, Zap, Shield } from 'lucide-react'

export function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="container py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Modern CRM + ERP Çözümü
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Satış, operasyon ve finans süreçlerinizi tek platformda yönetin.
            Ekibinizin verimliliğini artırın.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Button size="lg">
              Demo Talep Et <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline">
              Giriş Yap
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container py-24 bg-muted/50">
        <h2 className="text-3xl font-bold text-center mb-12">
          Tüm İhtiyaçlarınız İçin Tek Platform
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <Card className="p-6">
            <BarChart className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-bold text-xl mb-2">CRM</h3>
            <p className="text-sm text-muted-foreground">
              Lead, fırsat ve teklif yönetimi
            </p>
          </Card>
          <Card className="p-6">
            <Zap className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-bold text-xl mb-2">Operasyon</h3>
            <p className="text-sm text-muted-foreground">
              Görev, proje ve ekip takibi
            </p>
          </Card>
          <Card className="p-6">
            <Users className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-bold text-xl mb-2">Finans</h3>
            <p className="text-sm text-muted-foreground">
              Fatura, ödeme ve muhasebe
            </p>
          </Card>
          <Card className="p-6">
            <Shield className="h-12 w-12 text-primary mb-4" />
            <h3 className="font-bold text-xl mb-2">Güvenlik</h3>
            <p className="text-sm text-muted-foreground">
              Tenant izolasyonu ve RBAC
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Hemen Başlayın
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            14 gün ücretsiz deneyin. Kredi kartı gerekmez.
          </p>
          <Button size="lg">
            Ücretsiz Deneyin <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  )
}
```

### Blog List Page

```typescript
// src/pages/blog/index.tsx
import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import type { BlogPost } from '@/types'

export function BlogListPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/v1/blog/')
      .then(res => setPosts(res.data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div>Yükleniyor...</div>

  return (
    <div className="container py-12">
      <h1 className="text-4xl font-bold mb-8">Blog</h1>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {posts.map(post => (
          <Link key={post.id} to={`/blog/${post.slug}`}>
            <Card className="overflow-hidden hover:shadow-lg transition-shadow">
              {post.featured_image && (
                <img 
                  src={post.featured_image} 
                  alt={post.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-6">
                <Badge className="mb-2">{post.category_name}</Badge>
                <h2 className="font-bold text-xl mb-2">{post.title}</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {post.excerpt}
                </p>
                <div className="text-xs text-muted-foreground">
                  {new Date(post.published_at).toLocaleDateString('tr-TR')} • {post.author_name}
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

### Contact Page

```typescript
// src/pages/contact.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'

const contactSchema = z.object({
  name: z.string().min(2, 'Ad en az 2 karakter olmalı'),
  email: z.string().email('Geçerli bir email girin'),
  company: z.string().optional(),
  phone: z.string().optional(),
  message: z.string().min(10, 'Mesaj en az 10 karakter olmalı'),
})

type ContactForm = z.infer<typeof contactSchema>

export function ContactPage() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
  })

  const onSubmit = async (data: ContactForm) => {
    setLoading(true)
    try {
      await api.post('/v1/contact/', data)
      toast({
        title: 'Mesajınız gönderildi!',
        description: 'En kısa sürede size dönüş yapacağız.',
      })
      reset()
    } catch (error: any) {
      toast({
        title: 'Hata',
        description: error.response?.data?.detail || 'Bir hata oluştu',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold mb-8">İletişim</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Ad Soyad *</label>
            <Input {...register('name')} />
            {errors.name && (
              <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Email *</label>
            <Input type="email" {...register('email')} />
            {errors.email && (
              <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Şirket</label>
            <Input {...register('company')} />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Telefon</label>
            <Input {...register('phone')} />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Mesaj *</label>
            <Textarea {...register('message')} rows={5} />
            {errors.message && (
              <p className="text-sm text-destructive mt-1">{errors.message.message}</p>
            )}
          </div>
          
          <Button type="submit" disabled={loading}>
            {loading ? 'Gönderiliyor...' : 'Gönder'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

### Login Page (Auth Gateway)

```typescript
// src/pages/login.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import api from '@/lib/api'

interface LoginForm {
  username: string
  password: string
}

export function LoginPage() {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const { register, handleSubmit } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      // Login
      const loginRes = await api.post('/auth/login/', data)
      const { access, refresh } = loginRes.data
      
      // Store tokens
      localStorage.setItem('access_token', access)
      localStorage.setItem('refresh_token', refresh)
      
      // Get user info
      const meRes = await api.get('/auth/me/')
      const user = meRes.data
      
      // Auth Gateway: Redirect based on role
      if (user.is_superadmin) {
        window.location.href = 'https://admin.udarsoft.com'
      } else {
        window.location.href = 'https://crm.udarsoft.com'
      }
    } catch (error: any) {
      toast({
        title: 'Giriş Başarısız',
        description: error.response?.data?.detail || 'Kullanıcı adı veya şifre hatalı',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-12">
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-bold mb-8 text-center">Giriş Yap</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input type="email" {...register('username')} required />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Şifre</label>
            <Input type="password" {...register('password')} required />
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

---

## 🚀 ÇALIŞTIRMA

```bash
# Development
npm run dev

# Build
npm run build

# Preview
npm run preview
```

---

## 📝 SONRAKI ADIMLAR

1. ✅ Proje setup
2. ✅ Layout components
3. ✅ Home page
4. ✅ Blog pages
5. ✅ Contact page
6. ✅ Login page (auth gateway)
7. ⏳ Features page
8. ⏳ Pricing page
9. ⏳ Security page
10. ⏳ Responsive design
11. ⏳ SEO optimization
12. ⏳ Performance optimization

---

**Hazırlayan**: Kiro AI  
**Tarih**: 1 Mart 2026  
**Durum**: Implementation Guide Hazır 🎨
