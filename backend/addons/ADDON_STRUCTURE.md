# Udar Add-on Structure

Udar add-on yapısı XenForo mantığını CRM/ERP modüllerine uyarlar. Add-on bir ZIP olarak yüklenebilir veya sunucuda `backend/addons/Vendor/Addon` klasörüne konulabilir.

## Klasör

```text
Vendor/Addon/
  addon.json
  _data/
    permissions.json
    navigation.json
    routes.json
    options.json
    events.json
    jobs.json
    languages.json
    phrases.json
    templates.json
    template_modifications.json
    style_assets.json
  styles/
    addon.less
    addon.css
  migrations/
  backend/
  frontend/
```

## addon.json

```json
{
  "id": "Vendor/Addon",
  "title": "Addon Title",
  "vendor": "Vendor",
  "version": "1.0.0",
  "version_id": 1000000,
  "min_core_version": "1.0.0",
  "dependencies": [],
  "entrypoints": {
    "backend": "crm",
    "frontend": "quotes"
  }
}
```

## permissions.json

```json
{
  "groups": [
    { "id": "quotes", "title": "Teklifler", "display_order": 100 }
  ],
  "permissions": [
    { "code": "quotes.view.own", "title": "Kendi tekliflerini gör", "group": "quotes" }
  ]
}
```

İzinler kullanıcı gruplarına `allow`, `deny`, `unset` olarak atanır. Effective permission cache rebuild edilir.

## templates.json

```json
[
  {
    "type": "frontend",
    "title": "quotes.status_badge",
    "content": "<span>{{ phrase('quotes.status.pending') }}</span>"
  }
]
```

Desteklenen tipler: `admin`, `public`, `email`, `document`, `frontend`.

## template_modifications.json

```json
[
  {
    "type": "frontend",
    "template": "quotes.status_badge",
    "modification_key": "vendor_add_class",
    "description": "Status badge class ekler",
    "execution_order": 10,
    "enabled": true,
    "action": "str_replace",
    "find": "<span",
    "replace": "<span class=\"my-addon\""
  }
]
```

Desteklenen action değerleri: `str_replace`, `preg_replace`, `append`, `prepend`.

## phrases.json

```json
[
  { "language_id": "tr-TR", "title": "nav.quotes", "text": "Teklif & Sözleşmeler" },
  { "language_id": "en-US", "title": "nav.quotes", "text": "Quotes & Contracts" }
]
```

Runtime endpoint: `GET /api/phrases/?language_id=tr-TR`.

## LESS / CSS

`styles/*.less` ve `styles/*.css` otomatik `style_assets` olarak import edilir. Runtime endpoint:

```text
GET /api/addons/styles.css
```

## XenForo XML Uyumluluğu

JSON ana formattır. Ancak `_data/phrases.xml`, `_data/templates.xml`, `_data/template_modifications.xml` dosyaları da okunur. Bu sayede XenForo benzeri export/import akışı korunur.

## Lifecycle

- `discover`: `addon.json` bulunan paketler keşfedilir.
- `install`: `_data` kayıtları DB'ye import edilir.
- `enable`: navigation, route, permission, template ve style runtime'a açılır.
- `disable`: veri silinmez; runtime'dan düşer.
- `upgrade`: import tekrar çalışır ve cache rebuild edilir.
- `uninstall`: metadata pasiflenir.
- `delete`: sistem add-on'u değilse dosya ve metadata fiziksel silinir.

## Yönetim API

- `GET /api/addons/`
- `POST /api/addons/upload/`
- `POST /api/addons/install/`
- `POST /api/addons/upgrade/`
- `POST /api/addons/enable/`
- `POST /api/addons/disable/`
- `POST /api/addons/uninstall/`
- `POST /api/addons/delete/`
- `POST /api/addons/rebuild-templates/`
- `GET /api/addons/templates/`
- `GET /api/addons/template-modifications/`
- `GET /api/addons/compiled-templates/`
- `GET /api/addons/phrases/`
- `GET /api/addons/style-assets/`
