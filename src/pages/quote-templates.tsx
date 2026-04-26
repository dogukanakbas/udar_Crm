import { PageHeader } from '@/components/app-shell'
import { DocumentProductGroupManager, DocumentTemplateLibrary } from '@/components/document-template-library'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function QuoteTemplatesPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Şablon Yönetimi"
        description="Her satıcı firma için tek ana Excel şablonu yükleyin; sistem teklif, sözleşme ve dinamik ürün grubu tablolarını bu şablona otomatik yerleştirir."
      />
      <Tabs defaultValue="library" className="space-y-4">
        <TabsList>
          <TabsTrigger value="library">Excel şablonları</TabsTrigger>
          <TabsTrigger value="groups">Ürün grupları</TabsTrigger>
        </TabsList>
        <TabsContent value="library">
          <DocumentTemplateLibrary />
        </TabsContent>
        <TabsContent value="groups">
          <DocumentProductGroupManager />
        </TabsContent>
      </Tabs>
    </div>
  )
}
