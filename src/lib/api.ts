import axios from 'axios'
import { clearTokens, getTokens, saveTokens, type Tokens } from './auth'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

export const api = axios.create({
  baseURL,
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  const tokens = getTokens()
  if (tokens?.access) {
    config.headers = { ...(config.headers as any), Authorization: `Bearer ${tokens.access}` }
  }
  return config
})

let refreshing: Promise<string | null> | null = null
let refreshToastDismiss: (() => void) | null = null

async function refreshToken(refresh: string): Promise<string | null> {
  // Loading toast göster (sadece bir kez)
  if (!refreshToastDismiss) {
    import('@/components/ui/use-toast').then(({ toast }) => {
      const result = toast({
        title: 'Oturum yenileniyor...',
        description: 'Lütfen bekleyin',
      })
      refreshToastDismiss = result.dismiss
    })
  }
  
  try {
    const resp = await axios.post(`${baseURL}/auth/refresh/`, { refresh })
    const data = resp.data as { access?: string }
    if (data?.access) {
      const tokens = getTokens()
      const newTokens: Tokens = { access: data.access, refresh: tokens?.refresh || refresh }
      saveTokens(newTokens)
      return data.access
    }
    return null
  } finally {
    // Toast'u kapat
    if (refreshToastDismiss) {
      refreshToastDismiss()
      refreshToastDismiss = null
    }
  }
}

api.interceptors.response.use(
  (resp) => resp,
  async (error) => {
    const original = error.config
    
    // 403: Yetki yok - Kullanıcıyı bilgilendir
    if (error.response?.status === 403) {
      // Toast dinamik import (circular dependency önlemek için)
      import('@/components/ui/use-toast').then(({ toast }) => {
        toast({
          title: 'Yetki Hatası',
          description: 'Bu işlem için yetkiniz yok',
          variant: 'destructive',
        })
      })
      return Promise.reject(error)
    }
    
    // 401: Token refresh dene
    if (error.response?.status === 401 && !original.__isRetryRequest) {
      const tokens = getTokens()
      if (tokens?.refresh) {
        if (!refreshing) {
          refreshing = refreshToken(tokens.refresh).finally(() => {
            refreshing = null
          })
        }
        const newAccess = await refreshing
        if (newAccess) {
          original.__isRetryRequest = true
          original.headers = { ...original.headers, Authorization: `Bearer ${newAccess}` }
          return api(original)
        }
      }
      clearTokens()
      // Login sayfasında değilsek yönlendir
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.replace('/login')
      }
    }
    return Promise.reject(error)
  }
)

export async function login(username: string, password: string) {
  const resp = await api.post('/auth/login/', { username, password })
  const tokens = resp.data as Tokens
  saveTokens(tokens)
  return tokens
}

export function logout() {
  clearTokens()
}

export default api

