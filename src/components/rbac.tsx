import type { ReactNode } from 'react'
import { useAppStore } from '@/state/use-app-store'
import { hasPermission } from '@/lib/permissions'

type Props = { perm?: string; children: ReactNode; fallback?: ReactNode }

export function RbacGuard({ perm, children, fallback = null }: Props) {
  const role = useAppStore((s) => s.data.settings.role)
  const dynamicPerms = useAppStore((s) => s.data.rolePermissions || [])
  if (!perm) return <>{children}</>
  if (hasPermission(role, dynamicPerms, perm)) return <>{children}</>
  return <>{fallback}</>
}

type FormGuardProps = { 
  perm?: string
  children: ReactNode
}

export function RbacFormGuard({ perm, children }: FormGuardProps) {
  const role = useAppStore((s) => s.data.settings.role)
  const dynamicPerms = useAppStore((s) => s.data.rolePermissions || [])
  
  // Eğer perm belirtilmişse, önce yetki kontrolü yap
  if (perm) {
    const hasEditPerm = hasPermission(role, dynamicPerms, perm)
    
    if (!hasEditPerm) {
      return (
        <div className="relative">
          <div className="pointer-events-none opacity-60">
            {children}
          </div>
          <div className="absolute inset-0 bg-background/30 cursor-not-allowed" />
          <p className="text-sm text-muted-foreground mt-2">
            Bu işlem için yetkiniz yok
          </p>
        </div>
      )
    }
  }
  
  return <>{children}</>
}

