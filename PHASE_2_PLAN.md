# 🎨 PHASE 2: MARKETING WEBSITE - PLAN

**Tarih**: 1 Mart 2026  
**Süre**: 2-3 gün  
**Durum**: Başlıyor

---

## 🎯 AMAÇ

Public marketing website oluştur:
- **Domain**: udarsoft.com
- **Amaç**: Udar CRM'i tanıtmak, demo talepleri almak
- **Özellikler**: Ana sayfa, özellikler, blog, iletişim, login

---

## 📦 PROJE YAPISI

```
frontend-public/               # YENİ PROJE
├── src/
│   ├── pages/
│   │   ├── home.tsx          # Ana sayfa
│   │   ├── features.tsx      # Özellikler
│   │   ├── how-it-works.tsx  # Nasıl çalışır
│   │   ├── security.tsx      # Güvenlik
│   │   ├── pricing.tsx       # Fiyatlandırma
│   │   ├── blog/
│   │   │   ├── index.tsx     # Blog listesi
│   │   │   └── [slug].tsx    # Blog detay
│   │   ├── contact.tsx       # İletişim
│   │   └── login.tsx         # Login (auth gateway)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx    # Public header
│   │   │   └── footer.tsx    # Footer
│   │   ├── sections/
│   │   │   ├── hero.tsx      # Hero section
│   │   │   ├── features-grid.tsx
│   │   │   ├── pricing-cards.tsx
│   │   │   └── cta-section.tsx
│   │   └── ui/               # shadcn/ui components
│   ├── lib/
│   │   ├── api.ts            # Public API client
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
├── public/
│   └── images/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 🎨 SAYFALAR

### 1. Ana Sayfa (/)

**Hero Section**:
```
Başlık: Modern CRM + ERP Çözümü
Alt başlık: Satış, operasyon ve finans süreçlerinizi tek platformda yönetin
CTA: Demo Talep Et | Giriş Yap
Hero Image: Dashboard screenshot
```

**Features Grid** (4 kart):
- 📊 CRM: Lead, fırsat, teklif yönetimi
- ⚙️ Operasyon: Görev, proje, ekip takibi
- 💰 Finans: Fatura, ödeme, muhasebe
- 🎫 Destek: Ticket, SLA, otomasyon

**How It Works** (Timeline):
1. Lead → 2. Fırsat → 3. Teklif → 4. Onay → 5. Sipariş → 6. Fatura

**Social Proof**:
- Müşteri logoları (placeholder)
- Testimonials (3 kart)
- İstatistikler (1000+ kullanıcı, 50+ şirket)

**CTA Section**:
- "Hemen Başlayın" butonu
- "Demo Talep Et" butonu

### 2. Özellikler (/features)

**CRM Modülü**:
- Lead yönetimi
- Fırsat takibi
- Teklif oluşturma
- Onay süreçleri
- Pipeline görünümü

**Operasyon Modülü**:
- Görev yönetimi
- Kanban board
- Zaman takibi
- Ekip işbirliği
- SLA yönetimi

**Finans Modülü**:
- Fatura oluşturma
- Ödeme takibi
- Stok yönetimi
- Muhasebe entegrasyonu
- Raporlama

**Destek Modülü**:
- Ticket sistemi
- SLA yönetimi
- Otomasyon kuralları
- Bildirimler
- Audit logs

### 3. Nasıl Çalışır (/how-it-works)

**Satış Süreci**:
```
1. Lead Girişi
   ↓
2. Lead Puanlama
   ↓
3. Fırsat Oluşturma
   ↓
4. Teklif Hazırlama
   ↓
5. Onay Süreci
   ↓
6. Sipariş Oluşturma
   ↓
7. Fatura Kesme
   ↓
8. Ödeme Takibi
```

**Video/GIF**: Demo video (placeholder)

### 4. Güvenlik (/security)

**Güvenlik Özellikleri**:
- 🔒 Tenant İzolasyonu: Her müşteri kendi veritabanında
- 👥 RBAC: Role-based access control
- 📝 Audit Logs: Tüm işlemler loglanır
- 🔐 2FA: İki faktörlü kimlik doğrulama
- 🔑 HTTPS: Tüm iletişim şifreli
- 💾 Data Encryption: Veriler şifreli saklanır

**Compliance**:
- GDPR uyumlu
- ISO 27001 (placeholder)
- SOC 2 (placeholder)

### 5. Fiyatlandırma (/pricing)

**3 Plan**:

**Starter** - $29/ay:
- 5 kullanıcı
- 10 GB depolama
- Temel CRM
- Görev yönetimi
- Email destek

**Professional** - $99/ay:
- 20 kullanıcı
- 50 GB depolama
- Tüm CRM özellikleri
- ERP modülü
- API erişimi
- Öncelikli destek

**Enterprise** - Custom:
- Sınırsız kullanıcı
- Sınırsız depolama
- Tüm özellikler
- Özel entegrasyonlar
- Dedicated support
- SLA garantisi

**CTA**: "14 Gün Ücretsiz Deneyin"

### 6. Blog (/blog)

**Blog Listesi**:
- Grid layout (3 sütun)
- Featured image
- Başlık, özet, tarih, kategori
- Pagination
- Kategori filtresi
- Arama

**Blog Detay** (/blog/:slug):
- Featured image
- Başlık, tarih, yazar, kategori
- Markdown content
- İlgili yazılar
- Paylaş butonları

### 7. İletişim (/contact)

**İletişim Formu**:
- Ad Soyad
- Email
- Şirket (opsiyonel)
- Telefon (opsiyonel)
- Mesaj
- "Gönder" butonu

**İletişim Bilgileri**:
- Email: info@udarsoft.com
- Telefon: +90 XXX XXX XX XX
- Adres: İstanbul, Türkiye

**Harita**: Google Maps embed (placeholder)

### 8. Login (/login)

**Login Formu**:
- Email
- Şifre
- "Giriş Yap" butonu
- "Şifremi Unuttum" link

**Auth Gateway Logic**:
```typescript
// Login sonrası
const user = await api.post('/auth/login/', { username, password })
const me = await api.get('/auth/me/')

if (me.is_superadmin) {
  window.location.href = 'https://admin.udarsoft.com'
} else {
  window.location.href = 'https://crm.udarsoft.com'
}
```

---

## 🎨 DESIGN SYSTEM

### Colors
```css
--primary: #3b82f6      /* Blue */
--secondary: #8b5cf6    /* Purple */
--accent: #10b981       /* Green */
--background: #ffffff
--foreground: #0f172a
--muted: #f1f5f9
--border: #e2e8f0
```

### Typography
- Font: Inter (Google Fonts)
- Headings: font-bold
- Body: font-normal

### Components
- shadcn/ui (mevcut CRM ile aynı)
- Tailwind CSS
- Lucide icons

---

## 🔧 TEKNIK DETAYLAR

### Stack
- React 18
- TypeScript
- Vite
- TanStack Router
- Tailwind CSS
- shadcn/ui
- Axios

### API Client
```typescript
// src/lib/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
})

export default api
```

### Environment Variables
```bash
# .env
VITE_API_BASE_URL=http://localhost:8000/api
```

### Build
```bash
npm run build
# Output: dist/
```

---

## 📝 IMPLEMENTATION STEPS

### Step 1: Project Setup (30 min)
```bash
npm create vite@latest frontend-public -- --template react-ts
cd frontend-public
npm install
npm install @tanstack/react-router axios lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### Step 2: shadcn/ui Setup (15 min)
```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card input textarea
```

### Step 3: Layout Components (1 hour)
- Header (logo, nav, CTA)
- Footer (links, social, copyright)
- Page wrapper

### Step 4: Home Page (2 hours)
- Hero section
- Features grid
- How it works
- Social proof
- CTA section

### Step 5: Features Page (1 hour)
- Feature sections
- Screenshots (placeholder)

### Step 6: Pricing Page (1 hour)
- Pricing cards
- Feature comparison table

### Step 7: Blog Pages (2 hours)
- Blog list (API integration)
- Blog detail (API integration)
- Category filter

### Step 8: Contact Page (1 hour)
- Contact form
- Form validation
- API integration (rate limited)

### Step 9: Login Page (1 hour)
- Login form
- Auth gateway logic
- Error handling

### Step 10: Polish (2 hours)
- Responsive design
- Loading states
- Error states
- SEO meta tags

---

## 🚀 DEPLOYMENT

### Build
```bash
cd frontend-public
npm run build
```

### Nginx Config
```nginx
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
```

---

## ✅ CHECKLIST

- [ ] Project setup
- [ ] shadcn/ui setup
- [ ] Layout components (header, footer)
- [ ] Home page
- [ ] Features page
- [ ] How it works page
- [ ] Security page
- [ ] Pricing page
- [ ] Blog list page
- [ ] Blog detail page
- [ ] Contact page
- [ ] Login page (auth gateway)
- [ ] Responsive design
- [ ] API integration
- [ ] Error handling
- [ ] Loading states
- [ ] SEO meta tags

---

**Hazırlayan**: Kiro AI  
**Tarih**: 1 Mart 2026  
**Durum**: Planlama Tamamlandı 🎨
