import { useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export type SubSidebarTab = {
  id: string
  label: string
  icon?: LucideIcon
  group?: string
}

export type SubSidebarGroup = {
  id: string
  label: string
}

type PageSubSidebarProps = {
  tabs: SubSidebarTab[]
  groups?: SubSidebarGroup[]
  activeTab: string
  onTabChange: (tab: string) => void
  children: ReactNode
  sidebarWidth?: string
}

export function PageSubSidebar({
  tabs,
  groups,
  activeTab,
  onTabChange,
  children,
  sidebarWidth = '260px',
}: PageSubSidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const renderTabButton = (tab: SubSidebarTab) => {
    const TabIcon = tab.icon
    return (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-all duration-150',
          activeTab === tab.id
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
        )}
      >
        {TabIcon && <TabIcon className="h-4 w-4 shrink-0 opacity-80" />}
        <span className="truncate">{tab.label}</span>
      </button>
    )
  }

  const renderGroupedSidebar = () => {
    if (!groups || groups.length === 0) {
      return <div className="space-y-0.5">{tabs.map(renderTabButton)}</div>
    }

    const ungrouped = tabs.filter((t) => !t.group)
    return (
      <div className="space-y-1">
        {ungrouped.length > 0 && (
          <div className="space-y-0.5 mb-2">{ungrouped.map(renderTabButton)}</div>
        )}
        {groups.map((group) => {
          const groupTabs = tabs.filter((t) => t.group === group.id)
          if (groupTabs.length === 0) return null
          const isCollapsed = collapsedGroups.has(group.id)
          const hasActiveTab = groupTabs.some((t) => t.id === activeTab)

          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors',
                  hasActiveTab
                    ? 'text-primary'
                    : 'text-muted-foreground/60 hover:text-muted-foreground',
                )}
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    isCollapsed && '-rotate-90',
                  )}
                />
              </button>
              <div
                className={cn(
                  'space-y-0.5 overflow-hidden transition-all duration-200',
                  isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100',
                )}
              >
                {groupTabs.map(renderTabButton)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const mobileTabs = groups?.length
    ? [
        ...tabs
          .filter((tab) => !tab.group)
          .map((tab) => ({ tab, groupLabel: '' })),
        ...groups.flatMap((group) =>
          tabs
            .filter((tab) => tab.group === group.id)
            .map((tab) => ({ tab, groupLabel: group.label })),
        ),
      ]
    : tabs.map((tab) => ({ tab, groupLabel: '' }))

  return (
    <>
      {/* Desktop Sub-Sidebar */}
      <div
        className="grid gap-6 lg:grid-cols-[var(--sub-sidebar-width)_1fr]"
        style={{ '--sub-sidebar-width': sidebarWidth } as CSSProperties}
      >
        <aside className="hidden lg:block">
          <div className="sticky top-4 rounded-lg border bg-card p-2 shadow-sm space-y-0.5">
            {renderGroupedSidebar()}
          </div>
        </aside>

        {/* Mobile Tab Selector */}
        <div className="lg:hidden col-span-full">
          <Select value={activeTab} onValueChange={onTabChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Kategori seçin" />
            </SelectTrigger>
            <SelectContent>
              {mobileTabs.map(({ tab, groupLabel }) => (
                <SelectItem key={tab.id} value={tab.id}>
                  {groupLabel ? `${groupLabel} › ${tab.label}` : tab.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Content Area */}
        <div className="min-w-0 space-y-4">{children}</div>
      </div>
    </>
  )
}
