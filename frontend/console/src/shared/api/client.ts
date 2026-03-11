import axios from 'axios'
import { toast } from 'sonner'
import { isResultEnvelope, toCamelCaseDeep } from '@/shared/api/result'
import { env } from '@/shared/config/env'
import { useSessionStore } from '@/shared/stores/use-session-store'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl || undefined,
  timeout: 60_000
})

apiClient.interceptors.request.use((config) => {
  const token = useSessionStore.getState().token

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => {
    const transformed = toCamelCaseDeep(response.data)
    response.data = isResultEnvelope(transformed) ? transformed.data : transformed

    return response
  },
  (error) => {
    const status = error.response?.status
    const code = error.response?.data?.code
    const message = error.response?.data?.message || error.message || '请求失败，请稍后重试'
    const hasToken = useSessionStore.getState().token.trim().length > 0

    if (status === 401 || code === 1001 || code === 1002) {
      toast.error(hasToken ? 'Token 无效，请重新配置访问凭证' : '请先配置访问凭证')
    } else if (status === 429 || code === 2001) {
      toast.warning('触发限流，请稍后重试')
    } else {
      toast.error(message)
    }

    return Promise.reject(error)
  }
)
