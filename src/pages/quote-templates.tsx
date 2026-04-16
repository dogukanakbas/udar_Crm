import { PageHeader } from '@/components/app-shell'
import { DocumentTemplateLibrary } from '@/components/document-template-library'

export function QuoteTemplatesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Şablon Yönetimi"
        description="Teklif ve sözleşme şablonlarını ayrı ayrı indirip düzenleyebilir, logolu dosyaları sisteme yükleyebilirsiniz."
      />
      <DocumentTemplateLibrary />
    </div>
  )
}
