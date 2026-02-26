# 🚨 ACİL DÜZELTMELERİN DETAYI

## Yapılan Düzeltmeler

### 1. ✅ Worker Self-Handover (TAMAMLANDI)
- Backend endpoint eklendi
- Frontend UI eklendi
- Handover geçmişi iyileştirildi
- Detaylar: `DEGISIKLIKLER.md`

### 2. ✅ Celery Beat Scheduler Aktif Edildi (TAMAMLANDI)

**Dosya**: `backend/core/celery.py`

**Eklenen**:
```python
app.conf.beat_schedule = {
    'run-due-soon-automations': {
        'task': 'support.tasks.run_due_soon_automations',
        'schedule': 1800.0,  # Her 30 dakikada
    },
}
```

**Test**:
```bash
# Celery beat başlat
celery -A core beat --loglevel=info

# Celery worker başlat
celery -A core worker --loglevel=info
```

**Etki**: SLA uyarıları artık otomatik gönderilecek.

---

## Kalan Acil Görevler

### 3. 🔴 SMTP/Slack Gerçek Test (YAPILMALI)

**Durum**: Kod var, test edilmemiş

**Adımlar**:

#### SMTP Test
```bash
# .env dosyasına ekle:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_USE_TLS=true
SMTP_FROM=noreply@yourcompany.com
```

**Test Komutu**:
```python
# Django shell'de test
python manage.py shell

from support.utils import send_email
send_email('test@example.com', 'Test', 'Bu bir test mesajıdır')
```

#### Slack Test
```bash
# .env dosyasına ekle:
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

**Test Komutu**:
```python
from support.utils import send_slack_webhook
send_slack_webhook('Test mesajı')
```

**Beklenen Sonuç**:
- Mail gönderilmeli
- Slack'te mesaj görünmeli
- Hata varsa loglarda görünmeli

---

### 4. 🔴 Backend Testler (YAPILMALI)

**Durum**: Test suite yok

**Adımlar**:

#### Test Dosyaları Oluştur

**backend/support/tests.py**:
```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from organizations.models import Organization
from accounts.models import Team
from .models import Task

User = get_user_model()

class TaskTestCase(TestCase):
    def setUp(self):
        self.org = Organization.objects.create(name='Test Org')
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass',
            organization=self.org,
            role='Worker'
        )
        self.team = Team.objects.create(
            organization=self.org,
            name='Test Team'
        )
        self.team.members.add(self.user)
    
    def test_task_creation(self):
        task = Task.objects.create(
            organization=self.org,
            title='Test Task',
            owner=self.user,
            assignee=self.user,
            team=self.team,
            status='todo'
        )
        self.assertEqual(task.title, 'Test Task')
        self.assertEqual(task.status, 'todo')
    
    def test_task_claim(self):
        task = Task.objects.create(
            organization=self.org,
            title='Test Task',
            owner=self.user,
            team=self.team,
            status='todo'
        )
        # Claim endpoint test
        self.client.force_login(self.user)
        response = self.client.post(f'/api/tasks/{task.id}/claim/')
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.assignee, self.user)
    
    def test_self_handover(self):
        task = Task.objects.create(
            organization=self.org,
            title='Test Task',
            owner=self.user,
            assignee=self.user,
            team=self.team,
            status='todo'
        )
        target_team = Team.objects.create(
            organization=self.org,
            name='Target Team'
        )
        self.client.force_login(self.user)
        response = self.client.post(
            f'/api/tasks/{task.id}/self_handover/',
            {'team': target_team.id, 'reason': 'Test'}
        )
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.current_team, target_team)
        self.assertIsNone(task.assignee)
```

**Çalıştır**:
```bash
cd backend
python manage.py test support.tests
```

**Beklenen**: Tüm testler geçmeli.

---

### 5. 🔴 Presigned Upload Test (YAPILMALI)

**Durum**: Kod var, MinIO ile test edilmemiş

**Adımlar**:

#### MinIO Docker Ekle

**docker-compose.yml**'e ekle:
```yaml
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  minio_data:
```

#### .env Güncelle
```bash
PRESIGN_PROVIDER=minio
PRESIGN_ENDPOINT=http://localhost:9000
PRESIGN_BUCKET=uploads
PRESIGN_ACCESS_KEY=minioadmin
PRESIGN_SECRET_KEY=minioadmin
PRESIGN_REGION=us-east-1
PRESIGN_PREFIX=tasks
```

#### Test
```bash
# MinIO başlat
docker-compose up -d minio

# MinIO console'a git: http://localhost:9001
# Login: minioadmin / minioadmin
# Bucket oluştur: "uploads"

# Frontend'den dosya yükle
# Network tab'da presigned URL'i kontrol et
```

**Beklenen**: Dosya MinIO'ya yüklenmeli.

---

## Kontrol Listesi

- [x] Worker self-handover
- [x] Celery beat scheduler
- [ ] SMTP gerçek test
- [ ] Slack gerçek test
- [ ] Backend testler (%50 coverage)
- [ ] Presigned upload MinIO test

---

## Test Komutları

### Backend
```bash
# Tüm testleri çalıştır
cd backend
python manage.py test

# Coverage ile
pip install coverage
coverage run --source='.' manage.py test
coverage report
coverage html  # htmlcov/index.html
```

### Frontend
```bash
# Unit testler (henüz yok)
npm run test

# E2E testler (henüz yok)
npm run test:e2e
```

### Celery
```bash
# Beat scheduler
celery -A core beat --loglevel=info

# Worker
celery -A core worker --loglevel=info

# Her ikisi birden (dev)
celery -A core worker --beat --loglevel=info
```

### Docker
```bash
# Tüm servisleri başlat
docker-compose up -d

# Logları izle
docker-compose logs -f backend celery_worker celery_beat

# Servisleri durdur
docker-compose down
```

---

## Sonraki Adımlar

1. **SMTP/Slack test et** - Gerçek credentials ile
2. **Backend testler yaz** - En az %50 coverage
3. **Presigned upload test et** - MinIO ile
4. **2FA ekle** - pyotp ile
5. **CI/CD pipeline** - GitHub Actions

---

**Durum**: 2/5 Tamamlandı  
**Kalan Süre**: ~1 hafta  
**Öncelik**: Yüksek 🔴
