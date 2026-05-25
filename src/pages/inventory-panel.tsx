// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'

import { DataTable } from '@/components/data-table'
import { SortableTable } from '@/components/sortable-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { RbacGuard } from '@/components/rbac'
import { useAppStore } from '@/state/use-app-store'
import api from '@/lib/api'
import {
  downloadInventoryStateWorkbook,
  downloadInventoryTemplateWorkbook,
  parseInventoryWorkbook,
} from '@/lib/inventory-bulk-xlsx'
import { getDefaultPriceList, normalizePriceLists, type PriceListOption } from '@/lib/price-lists'
import { formatCurrency } from '@/lib/utils'
import type { Category, Product } from '@/types'

const EMPTY_CATEGORY = {
  name: '',
  templateDefaults: { section_key: '', unit: '', tax: 20, discount: 0, discount_secondary: 0, template_family: '', technical_items: [] },
  attributeSchema: [],
}

const EMPTY_PRODUCT = {
  sku: '',
  name: '',
  categoryId: '',
  price: 0,
  priceLists: {},
  stock: 0,
  reserved: 0,
  reorderPoint: 0,
  templateDefaults: { section_key: '', unit: '', tax: 20, discount: 0, discount_secondary: 0, template_family: '', technical_items: [] },
  attributeValues: {},
  attributeSchemaOverride: [],
}

export function InventoryPanel() {
  const {
    data,
    adjustInventory,
    upsertCategory,
    upsertProduct,
    deleteProduct,
    bulkDeleteProducts,
    bulkUpsertProducts,
    syncTemplateCatalogToInventory,
  } = useAppStore()
  const { toast } = useToast()
  const bulkImportInputRef = useRef<HTMLInputElement | null>(null)
  const [adjustSku, setAdjustSku] = useState<string | null>(null)
  const [openProduct, setOpenProduct] = useState(false)
  const [openCategory, setOpenCategory] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [importingTemplateCatalog, setImportingTemplateCatalog] = useState(false)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null)
  const [priceLists, setPriceLists] = useState<PriceListOption[]>(normalizePriceLists())
  const [reorderingProducts, setReorderingProducts] = useState(false)
  const [reorderingCategories, setReorderingCategories] = useState(false)

  const products = data.products || []
  const categories = data.categories || []
  const lowStock = useMemo(() => products.filter((item) => item.stock - item.reserved < item.reorderPoint), [products])
  const importedTemplateProducts = useMemo(
    () => products.filter((item) => item.attributeValues?.import_origin === 'excel_templates'),
    [products]
  )

  useEffect(() => {
    api
      .get('/auth/organization-settings/')
      .then((response) => setPriceLists(normalizePriceLists(response.data?.price_lists)))
      .catch(() => setPriceLists(normalizePriceLists()))
  }, [])

  const triggerBulkImportPicker = () => {
    bulkImportInputRef.current?.click()
  }

  const handleBulkImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBulkImporting(true)
    try {
      const workbookPayload = await parseInventoryWorkbook(file)
      const result = await bulkUpsertProducts(workbookPayload)
      toast({
        title: 'Toplu ürün içe aktarma tamamlandı',
        description: `${result.created_products} yeni ürün, ${result.updated_products} mevcut ürün güncellendi.`,
      })
    } catch (error) {
      const description =
        error instanceof Error && error.message
          ? error.message
          : 'Excel dosyası işlenemedi, şablon yapısını kontrol edip tekrar deneyin.'
      toast({
        title: 'İçe aktarma başarısız',
        description,
        variant: 'destructive',
      })
    } finally {
      setBulkImporting(false)
    }
  }

  const handleDeleteAllProducts = async () => {
    if (products.length === 0) {
      toast({ title: 'Silinecek ürün yok' })
      return
    }
    const confirmation = window.prompt(
      `${products.length} ürün ve bu ürünlere bağlı stok hareketleri silinecek. Eski teklif satırları korunur ancak ürün bağlantıları boşalır.\n\nDevam etmek için SİL yazın.`
    )
    if (confirmation !== 'SİL') return

    setBulkDeleting(true)
    try {
      const result = await bulkDeleteProducts({ all: true })
      toast({
        title: 'Ürün listesi sıfırlandı',
        description: `${result.deleted_products} ürün ve ${result.deleted_stock_movements} stok hareketi silindi.`,
      })
    } catch {
      toast({
        title: 'Toplu silme başarısız',
        description: 'Ürün listesi silinemedi, lütfen tekrar deneyin.',
        variant: 'destructive',
      })
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleReorderProducts = async (reorderedProducts: Product[]) => {
    setReorderingProducts(true)
    try {
      const new_positions = reorderedProducts.map((product, index) => ({
        id: product.id,
        order: index,
      }))
      await api.post('/products/reorder/', { new_positions })
      toast({
        title: 'Ürün sıralaması güncellendi',
        description: `${reorderedProducts.length} ürün başarıyla sıralandı.`,
      })
    } catch (error) {
      toast({
        title: 'Sıralama güncellenemedi',
        description: 'Ürün sıralama işlemi başarısız oldu, lütfen tekrar deneyin.',
        variant: 'destructive',
      })
      throw error
    } finally {
      setReorderingProducts(false)
    }
  }

  const handleReorderCategories = async (reorderedCategories: Category[]) => {
    setReorderingCategories(true)
    try {
      const new_positions = reorderedCategories.map((category, index) => ({
        id: category.id,
        order: index,
      }))
      await api.post('/categories/reorder/', { new_positions })
      toast({
        title: 'Kategori sıralaması güncellendi',
        description: `${reorderedCategories.length} kategori başarıyla sıralandı.`,
      })
    } catch (error) {
      toast({
        title: 'Kategori sıralama güncellenemedi',
        description: 'Kategori sıralama işlemi başarısız oldu, lütfen tekrar deneyin.',
        variant: 'destructive',
      })
      throw error
    } finally {
      setReorderingCategories(false)
    }
  }

  const productColumns: ColumnDef<Product>[] = [
    { accessorKey: 'sku', header: 'SKU' },
    { accessorKey: 'name', header: 'Ürün' },
    { accessorKey: 'categoryName', header: 'Kategori' },
    { accessorKey: 'price', header: 'Fiyat', cell: ({ row }) => formatCurrency(row.original.price || 0) },
    { accessorKey: 'stock', header: 'Stok' },
    { accessorKey: 'reserved', header: 'Rezerve' },
    { accessorKey: 'reorderPoint', header: 'Emniyet st.' },
    { accessorKey: 'family', header: 'Şablon ailesi', cell: ({ row }) => row.original.templateFamily || row.original.templateDefaults?.template_family || '-' },
    { accessorKey: 'fields', header: 'Teknik alan', cell: ({ row }) => Object.keys(row.original.attributeValues || {}).length || 0 },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <RbacGuard perm="inventory.edit">
            <Button size="sm" variant="outline" onClick={() => setAdjustSku(row.original.sku)}>
              Güncelle
            </Button>
          </RbacGuard>
          <RbacGuard perm="products.edit">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditingProduct(row.original)
                setOpenProduct(true)
              }}
            >
              Düzenle
            </Button>
          </RbacGuard>
          <RbacGuard perm="products.edit">
            <Button
              size="sm"
              variant="ghost"
              disabled={deletingProductId === row.original.id}
              onClick={async () => {
                const confirmed = window.confirm(`${row.original.name} ürününü silmek istiyor musun?`)
                if (!confirmed) return
                setDeletingProductId(row.original.id)
                try {
                  await deleteProduct(row.original.id)
                  toast({ title: 'Ürün silindi' })
                } catch {
                  toast({
                    title: 'Ürün silinemedi',
                    description: 'Silme işlemi tamamlanamadı, lütfen tekrar deneyin.',
                    variant: 'destructive',
                  })
                } finally {
                  setDeletingProductId(null)
                }
              }}
            >
              {deletingProductId === row.original.id ? 'Siliniyor...' : 'Sil'}
            </Button>
          </RbacGuard>
        </div>
      ),
    },
  ]

  const categoryColumns: ColumnDef<Category>[] = [
    { accessorKey: 'name', header: 'Kategori' },
    { accessorKey: 'section', header: 'Belge grubu', cell: ({ row }) => row.original.templateDefaults?.section_key || '-' },
    { accessorKey: 'unit', header: 'Birim', cell: ({ row }) => row.original.templateDefaults?.unit || '-' },
    { accessorKey: 'family', header: 'Şablon ailesi', cell: ({ row }) => row.original.templateDefaults?.template_family || '-' },
    { accessorKey: 'fields', header: 'Alan sayısı', cell: ({ row }) => row.original.attributeSchema?.length || 0 },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <RbacGuard perm="products.edit">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingCategory(row.original)
              setOpenCategory(true)
            }}
          >
            Düzenle
          </Button>
        </RbacGuard>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.5fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Toplam ürün</CardDescription>
            <CardTitle className="text-3xl">{products.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Stokta görünen tüm ürün kartları.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Excel entegrasyonu</CardDescription>
            <CardTitle className="text-3xl">{importedTemplateProducts.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Şablonlardan içeri alınan ürün sayısı.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Kategori şablonu</CardDescription>
            <CardTitle className="text-3xl">{categories.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Belge grubu ve teknik alan tanımları.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Düşük stok akışı</CardTitle>
            <CardDescription>Satın alma için hızlı görünüm</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="destructive">{lowStock.length} düşük stok</Badge>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Şu an aksiyon gerektiren düşük stok görünmüyor.</p>
            ) : (
              lowStock.slice(0, 3).map((item) => (
                <div key={item.sku} className="rounded-lg border border-border/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">SKU {item.sku}</p>
                      <p className="text-xs text-muted-foreground">{item.categoryName || item.category || 'Kategori yok'}</p>
                    </div>
                    <Badge variant="outline">Stok {item.stock - item.reserved}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stok paneli</CardTitle>
          <CardDescription>Ürünler, kategori şablonları ve dinamik teknik alanlar</CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={bulkImportInputRef}
            type="file"
            accept=".xlsx,.xls,.xlsm,.xltx"
            className="hidden"
            onChange={handleBulkImportFile}
          />
          <Tabs defaultValue="products">
            <TabsList className="mb-4 grid w-full max-w-[720px] grid-cols-2">
              <TabsTrigger value="products">Ürünler</TabsTrigger>
              <TabsTrigger value="categories">Kategori şablonları</TabsTrigger>
            </TabsList>
            <TabsContent value="products" className="space-y-3">
              <div className="flex flex-wrap justify-end gap-2">
                <RbacGuard perm="products.edit">
                  <Button size="sm" variant="outline" onClick={() => downloadInventoryTemplateWorkbook(priceLists, categories)}>
                    Şablon indir
                  </Button>
                </RbacGuard>
                <RbacGuard perm="products.view">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadInventoryStateWorkbook(products, categories, priceLists)}
                  >
                    Dışa aktar
                  </Button>
                </RbacGuard>
                <RbacGuard perm="products.edit">
                  <Button size="sm" variant="outline" disabled={bulkImporting} onClick={triggerBulkImportPicker}>
                    {bulkImporting ? 'İçe aktarılıyor...' : 'Şablondan içe aktar'}
                  </Button>
                </RbacGuard>
                <RbacGuard perm="products.edit">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={importingTemplateCatalog}
                    onClick={async () => {
                      setImportingTemplateCatalog(true)
                      try {
                        const result = await syncTemplateCatalogToInventory()
                        toast({
                          title: 'Şablon ürünleri stoğa eklendi',
                          description: `${result.created_products} yeni ürün, ${result.updated_products} mevcut ürün güncellendi.`,
                        })
                      } catch {
                        toast({
                          title: 'Şablon ürünleri eklenemedi',
                          description: 'Stok kataloğu güncellenemedi, lütfen tekrar deneyin.',
                          variant: 'destructive',
                        })
                      } finally {
                        setImportingTemplateCatalog(false)
                      }
                    }}
                  >
                    {importingTemplateCatalog ? 'Ekleniyor...' : 'Şablon ürünlerini stoğa ekle'}
                  </Button>
                </RbacGuard>
                <RbacGuard perm="products.edit">
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={bulkDeleting || products.length === 0}
                    onClick={handleDeleteAllProducts}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {bulkDeleting ? 'Siliniyor...' : 'Tüm ürünleri sil'}
                  </Button>
                </RbacGuard>
                <RbacGuard perm="products.edit">
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingProduct(null)
                      setOpenProduct(true)
                    }}
                  >
                    Yeni ürün
                  </Button>
                </RbacGuard>
              </div>
              <SortableTable
                columns={productColumns}
                data={products}
                searchKey="sku"
                pageSizeOptions={[10, 25, 50, 100]}
                initialPageSize={25}
                enableDragAndDrop={true}
                onReorder={handleReorderProducts}
                getRowId={(product) => String(product.id)}
              />
            </TabsContent>
            <TabsContent value="categories" className="space-y-3">
              <div className="flex justify-end">
                <RbacGuard perm="products.edit">
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingCategory(null)
                      setOpenCategory(true)
                    }}
                  >
                    Yeni kategori şablonu
                  </Button>
                </RbacGuard>
              </div>
              <SortableTable
                columns={categoryColumns}
                data={categories}
                searchKey="name"
                enableDragAndDrop={true}
                onReorder={handleReorderCategories}
                getRowId={(category) => String(category.id)}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <AdjustStockDialog sku={adjustSku} onClose={() => setAdjustSku(null)} onAdjust={(sku, delta) => { adjustInventory(sku, delta); setAdjustSku(null); toast({ title: `${sku} stok güncellendi` }) }} />
      <ProductEditorDialog open={openProduct} product={editingProduct} categories={categories} priceLists={priceLists} onClose={() => setOpenProduct(false)} onSave={async (payload) => { await upsertProduct(payload as any); setOpenProduct(false); setEditingProduct(null); toast({ title: 'Ürün kaydedildi' }) }} />
      <CategoryTemplateDialog open={openCategory} category={editingCategory} onClose={() => setOpenCategory(false)} onSave={async (payload) => { await upsertCategory(payload as any); setOpenCategory(false); setEditingCategory(null); toast({ title: 'Kategori şablonu kaydedildi' }) }} />
    </div>
  )
}

function AdjustStockDialog({ sku, onClose, onAdjust }: { sku: string | null; onClose: () => void; onAdjust: (sku: string, delta: number) => void }) {
  const [delta, setDelta] = useState(5)
  useEffect(() => setDelta(5), [sku])
  if (!sku) return null
  return (
    <Dialog open={!!sku} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stok güncelle {sku}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>Degisim</Label>
          <Input type="number" value={delta} onChange={(event) => setDelta(Number(event.target.value))} />
        </div>
        <DialogFooter>
          <Button onClick={() => onAdjust(sku, Number(delta || 0))}>Güncelle</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ProductEditorDialog({ open, product, categories, priceLists, onClose, onSave }: { open: boolean; product?: Product | null; categories: Category[]; priceLists: PriceListOption[]; onClose: () => void; onSave: (payload: any) => void }) {
  const [values, setValues] = useState<any>(EMPTY_PRODUCT)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const selectedCategory = categories.find((category) => category.id === values.categoryId)
  const mergedSchema = [...(selectedCategory?.attributeSchema || []), ...(values.attributeSchemaOverride || [])]

  useEffect(() => {
    if (!open) return
    setValues(
      product
        ? {
            id: product.id,
            sku: product.sku,
            name: product.name,
            categoryId: product.categoryId || '',
            price: product.price || 0,
            priceLists: { ...(product.priceLists || {}), [getDefaultPriceList(priceLists).key]: product.price || 0 },
            stock: product.stock || 0,
            reserved: product.reserved || 0,
            reorderPoint: product.reorderPoint || 0,
            templateDefaults: {
              section_key: product.templateDefaults?.section_key || '',
              unit: product.templateDefaults?.unit || '',
              tax: Number(product.templateDefaults?.tax ?? 20),
              discount: Number(product.templateDefaults?.discount ?? 0),
              discount_secondary: Number(product.templateDefaults?.discount_secondary ?? 0),
              template_family: product.templateDefaults?.template_family || '',
              technical_items: Array.isArray(product.templateDefaults?.technical_items) ? product.templateDefaults.technical_items : [],
            },
            attributeValues: product.attributeValues || {},
            attributeSchemaOverride: product.attributeSchemaOverride || [],
          }
        : { ...EMPTY_PRODUCT, priceLists: Object.fromEntries(priceLists.map((item) => [item.key, 0])) }
    )
    setSubmitError(null)
  }, [open, product, priceLists])

  const setBasic = (key: string, value: any) => setValues((current: any) => ({ ...current, [key]: value }))
  const setTemplate = (key: string, value: any) => setValues((current: any) => ({ ...current, templateDefaults: { ...current.templateDefaults, [key]: value } }))
  const setPriceListValue = (key: string, value: any) =>
    setValues((current: any) => {
      const nextPriceLists = { ...(current.priceLists || {}), [key]: Number(value || 0) }
      const defaultKey = getDefaultPriceList(priceLists).key
      return { ...current, priceLists: nextPriceLists, price: key === defaultKey ? Number(value || 0) : current.price }
    })
  const setAttr = (key: string, value: any) => setValues((current: any) => ({ ...current, attributeValues: { ...(current.attributeValues || {}), [key]: value } }))
  const addTechnicalItem = () => setTemplate('technical_items', [...(values.templateDefaults?.technical_items || []), ''])
  const updateTechnicalItem = (index: number, value: string) => setTemplate('technical_items', (values.templateDefaults?.technical_items || []).map((item: string, itemIndex: number) => (itemIndex === index ? value : item)))
  const removeTechnicalItem = (index: number) => setTemplate('technical_items', (values.templateDefaults?.technical_items || []).filter((_: string, itemIndex: number) => itemIndex !== index))
  const addOverride = () => setValues((current: any) => ({ ...current, attributeSchemaOverride: [...(current.attributeSchemaOverride || []), createSchemaRow((current.attributeSchemaOverride || []).length)] }))
  const updateOverride = (index: number, key: string, value: any) => setValues((current: any) => ({ ...current, attributeSchemaOverride: (current.attributeSchemaOverride || []).map((row: any, rowIndex: number) => (rowIndex === index ? { ...row, [key]: value } : row)) }))
  const removeOverride = (index: number) => setValues((current: any) => ({ ...current, attributeSchemaOverride: (current.attributeSchemaOverride || []).filter((_: any, rowIndex: number) => rowIndex !== index) }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Ürünü düzenle' : 'Yeni ürün'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU"><Input value={values.sku || ''} onChange={(event) => setBasic('sku', event.target.value)} /></Field>
            <Field label="Ad"><Input value={values.name || ''} onChange={(event) => setBasic('name', event.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori">
              <Select
                value={values.categoryId || '__none__'}
                onValueChange={(value) => {
                  const nextCategory = categories.find((item) => item.id === value)
                  setBasic('categoryId', value === '__none__' ? '' : value)
                  if (nextCategory) {
                    setValues((current: any) => ({
                      ...current,
                      categoryId: nextCategory.id,
                      templateDefaults: {
                        section_key: current.templateDefaults?.section_key || nextCategory.templateDefaults?.section_key || '',
                        unit: current.templateDefaults?.unit || nextCategory.templateDefaults?.unit || '',
                        tax: Number(current.templateDefaults?.tax ?? nextCategory.templateDefaults?.tax ?? 20),
                        discount: Number(current.templateDefaults?.discount ?? nextCategory.templateDefaults?.discount ?? 0),
                        discount_secondary: Number(current.templateDefaults?.discount_secondary ?? nextCategory.templateDefaults?.discount_secondary ?? 0),
                        template_family: current.templateDefaults?.template_family || nextCategory.templateDefaults?.template_family || '',
                        technical_items: current.templateDefaults?.technical_items || [],
                      },
                    }))
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Kategori seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Kategori yok</SelectItem>
                  {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Şablon ailesi"><Input value={values.templateDefaults?.template_family || ''} onChange={(event) => setTemplate('template_family', event.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Fiyat"><Input type="number" value={values.price || 0} onChange={(event) => setPriceListValue(getDefaultPriceList(priceLists).key, event.target.value)} /></Field>
            <Field label="Stok"><Input type="number" value={values.stock || 0} onChange={(event) => setBasic('stock', Number(event.target.value))} /></Field>
            <Field label="Rezerve"><Input type="number" value={values.reserved || 0} onChange={(event) => setBasic('reserved', Number(event.target.value))} /></Field>
            <Field label="Emniyet st."><Input type="number" value={values.reorderPoint || 0} onChange={(event) => setBasic('reorderPoint', Number(event.target.value))} /></Field>
          </div>
          <div className="space-y-3 rounded-lg border border-border/70 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">Fiyat listeleri</p>
              <span className="text-xs text-muted-foreground">{priceLists.length} liste</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {priceLists.map((priceList) => (
                <Field key={priceList.key} label={priceList.label}>
                  <Input
                    type="number"
                    value={values.priceLists?.[priceList.key] ?? (priceList.is_default ? values.price || 0 : 0)}
                    onChange={(event) => setPriceListValue(priceList.key, event.target.value)}
                  />
                </Field>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <Field label="Belge grubu"><Input value={values.templateDefaults?.section_key || ''} onChange={(event) => setTemplate('section_key', event.target.value)} /></Field>
            <Field label="Vars. birim"><Input value={values.templateDefaults?.unit || ''} onChange={(event) => setTemplate('unit', event.target.value)} /></Field>
            <Field label="Vars. KDV"><Input type="number" value={values.templateDefaults?.tax || 0} onChange={(event) => setTemplate('tax', Number(event.target.value))} /></Field>
            <Field label="Vars. iskonto"><Input type="number" value={values.templateDefaults?.discount || 0} onChange={(event) => setTemplate('discount', Number(event.target.value))} /></Field>
            <Field label="Vars. iskonto 2"><Input type="number" value={values.templateDefaults?.discount_secondary || 0} onChange={(event) => setTemplate('discount_secondary', Number(event.target.value))} /></Field>
          </div>

          <div className="space-y-3 rounded-lg border border-border/70 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium">Ürüne özel teknik maddeler</p>
                <p className="text-xs text-muted-foreground">Teklif oluştururken bu ürün seçildiğinde maddeler ayrı ayrı düzenlenebilir.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addTechnicalItem}>
                Madde ekle
              </Button>
            </div>
            {(values.templateDefaults?.technical_items || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Henüz teknik madde yok.</p>
            ) : (
              <div className="space-y-2">
                {(values.templateDefaults?.technical_items || []).map((item: string, index: number) => (
                  <div key={`product-technical-${index}`} className="grid gap-2 md:grid-cols-[1fr_auto]">
                    <Input value={item} onChange={(event) => updateTechnicalItem(index, event.target.value)} placeholder={`${index + 1}. teknik madde`} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeTechnicalItem(index)}>
                      Sil
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {mergedSchema.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border/70 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">Teknik alan değerleri</p>
                <span className="text-xs text-muted-foreground">{mergedSchema.length} alan</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {mergedSchema.map((field: any) => (
                  <DynamicValueField key={field.field_key} field={field} value={values.attributeValues?.[field.field_key] ?? ''} onChange={(nextValue) => setAttr(field.field_key, nextValue)} />
                ))}
              </div>
            </div>
          )}

          <SchemaBuilder title="Ürüne özel ek alanlar" rows={values.attributeSchemaOverride || []} onAdd={addOverride} onChange={updateOverride} onRemove={removeOverride} />
        </div>
        <DialogFooter>
          {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
          <Button
            onClick={async () => {
              setSubmitError(null)
              try {
                await onSave({
                  id: product?.id,
                  sku: values.sku || '',
                  name: values.name || values.sku || '',
                  categoryId: values.categoryId || undefined,
                  price: Number(values.price || 0),
                  priceLists: values.priceLists || {},
                  price_lists: values.priceLists || {},
                  stock: Number(values.stock || 0),
                  reserved: Number(values.reserved || 0),
                  reorderPoint: Number(values.reorderPoint || 0),
                  reorder_point: Number(values.reorderPoint || 0),
                  templateDefaults: { ...(values.templateDefaults || {}), technical_items: (values.templateDefaults?.technical_items || []).map((item: string) => String(item || '').trim()).filter(Boolean) },
                  template_defaults: { ...(values.templateDefaults || {}), technical_items: (values.templateDefaults?.technical_items || []).map((item: string) => String(item || '').trim()).filter(Boolean) },
                  attributeValues: values.attributeValues || {},
                  attribute_values: values.attributeValues || {},
                  attributeSchemaOverride: values.attributeSchemaOverride || [],
                  attribute_schema_override: values.attributeSchemaOverride || [],
                })
              } catch (err: any) {
                const detail = err?.response?.data
                setSubmitError(detail?.sku?.[0] || detail?.name?.[0] || detail?.detail || 'Kaydedilemedi')
              }
            }}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryTemplateDialog({ open, category, onClose, onSave }: { open: boolean; category?: Category | null; onClose: () => void; onSave: (payload: any) => void }) {
  const [values, setValues] = useState<any>(EMPTY_CATEGORY)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setValues(
      category
        ? {
            id: category.id,
            name: category.name,
            templateDefaults: {
              section_key: category.templateDefaults?.section_key || '',
              unit: category.templateDefaults?.unit || '',
              tax: Number(category.templateDefaults?.tax ?? 20),
              discount: Number(category.templateDefaults?.discount ?? 0),
              discount_secondary: Number(category.templateDefaults?.discount_secondary ?? 0),
              template_family: category.templateDefaults?.template_family || '',
              technical_items: Array.isArray(category.templateDefaults?.technical_items) ? category.templateDefaults.technical_items.slice(0, 1) : [],
            },
            attributeSchema: category.attributeSchema || [],
          }
        : EMPTY_CATEGORY
    )
    setSubmitError(null)
  }, [open, category])

  const setBasic = (key: string, value: any) => setValues((current: any) => ({ ...current, [key]: value }))
  const setTemplate = (key: string, value: any) => setValues((current: any) => ({ ...current, templateDefaults: { ...current.templateDefaults, [key]: value } }))
  const addSchema = () => setValues((current: any) => ({ ...current, attributeSchema: [...(current.attributeSchema || []), createSchemaRow((current.attributeSchema || []).length)] }))
  const updateSchema = (index: number, key: string, value: any) => setValues((current: any) => ({ ...current, attributeSchema: (current.attributeSchema || []).map((row: any, rowIndex: number) => (rowIndex === index ? { ...row, [key]: value } : row)) }))
  const removeSchema = (index: number) => setValues((current: any) => ({ ...current, attributeSchema: (current.attributeSchema || []).filter((_: any, rowIndex: number) => rowIndex !== index) }))

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{category ? 'Kategori şablonunu düzenle' : 'Yeni kategori şablonu'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori adı"><Input value={values.name || ''} onChange={(event) => setBasic('name', event.target.value)} /></Field>
            <Field label="Şablon ailesi"><Input value={values.templateDefaults?.template_family || ''} onChange={(event) => setTemplate('template_family', event.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <Field label="Belge grubu"><Input value={values.templateDefaults?.section_key || ''} onChange={(event) => setTemplate('section_key', event.target.value)} /></Field>
            <Field label="Vars. birim"><Input value={values.templateDefaults?.unit || ''} onChange={(event) => setTemplate('unit', event.target.value)} /></Field>
            <Field label="KDV"><Input type="number" value={values.templateDefaults?.tax || 0} onChange={(event) => setTemplate('tax', Number(event.target.value))} /></Field>
            <Field label="Iskonto"><Input type="number" value={values.templateDefaults?.discount || 0} onChange={(event) => setTemplate('discount', Number(event.target.value))} /></Field>
            <Field label="Iskonto 2"><Input type="number" value={values.templateDefaults?.discount_secondary || 0} onChange={(event) => setTemplate('discount_secondary', Number(event.target.value))} /></Field>
          </div>
          <Field label="Varsayılan teknik madde">
            <Input value={(values.templateDefaults?.technical_items || [])[0] || ''} onChange={(event) => setTemplate('technical_items', event.target.value.trim() ? [event.target.value] : [])} placeholder="Bu kategori için tek satırlık varsayılan madde" />
          </Field>
          <SchemaBuilder title="Teknik alan şablonu" rows={values.attributeSchema || []} onAdd={addSchema} onChange={updateSchema} onRemove={removeSchema} />
        </div>
        <DialogFooter>
          {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
          <Button
            onClick={async () => {
              setSubmitError(null)
              try {
                const templateDefaults = {
                  ...(values.templateDefaults || {}),
                  technical_items: (values.templateDefaults?.technical_items || []).map((item: string) => String(item || '').trim()).filter(Boolean).slice(0, 1),
                }
                await onSave({ id: category?.id, name: values.name || '', templateDefaults, template_defaults: templateDefaults, attributeSchema: values.attributeSchema || [], attribute_schema: values.attributeSchema || [] })
              } catch (err: any) {
                const detail = err?.response?.data
                setSubmitError(detail?.name?.[0] || detail?.detail || 'Kaydedilemedi')
              }
            }}
          >
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SchemaBuilder({ title, rows, onAdd, onChange, onRemove }: { title: string; rows: any[]; onAdd: () => void; onChange: (index: number, key: string, value: any) => void; onRemove: (index: number) => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-border/70 p-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">{title}</p>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          Alan ekle
        </Button>
      </div>
      {rows.map((field, index) => (
        <div key={`schema-${index}`} className="grid gap-3 rounded-lg border border-border/60 p-3 md:grid-cols-6">
          <Field label="Key"><Input value={field.field_key || ''} onChange={(event) => onChange(index, 'field_key', event.target.value)} /></Field>
          <Field label="Etiket"><Input value={field.label || ''} onChange={(event) => onChange(index, 'label', event.target.value)} /></Field>
          <Field label="Tip">
            <Select value={field.type || 'text'} onValueChange={(value) => onChange(index, 'type', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['text', 'number', 'select', 'textarea'].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Options"><Input value={(field.options || []).join(', ')} onChange={(event) => onChange(index, 'options', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} /></Field>
          <Field label="Belge">
            <Select value={field.applies_to_documents || 'both'} onValueChange={(value) => onChange(index, 'applies_to_documents', value)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="both">both</SelectItem><SelectItem value="quote">quote</SelectItem><SelectItem value="contract">contract</SelectItem></SelectContent>
            </Select>
          </Field>
          <div className="flex items-end"><Button type="button" variant="ghost" size="sm" onClick={() => onRemove(index)}>Sil</Button></div>
        </div>
      ))}
    </div>
  )
}

function DynamicValueField({ field, value, onChange }: { field: any; value: any; onChange: (nextValue: any) => void }) {
  if (field.type === 'textarea') return <Field label={field.label} className="md:col-span-2"><Textarea value={value} onChange={(event) => onChange(event.target.value)} /></Field>
  if (field.type === 'select') {
    return (
      <Field label={field.label}>
        <Select value={String(value || '__empty__')} onValueChange={(nextValue) => onChange(nextValue === '__empty__' ? '' : nextValue)}>
          <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
          <SelectContent><SelectItem value="__empty__">Boş</SelectItem>{(field.options || []).map((option: string) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
    )
  }
  return <Field label={field.label}><Input type={field.type === 'number' ? 'number' : 'text'} value={value} onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)} /></Field>
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function createSchemaRow(order: number) {
  return { field_key: '', label: '', type: 'text', options: [], required: false, order, applies_to_documents: 'both' }
}
