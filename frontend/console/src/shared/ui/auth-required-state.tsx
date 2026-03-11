import { ShieldAlert } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

type AuthRequiredStateProps = {
  description?: string
  title?: string
}

export function AuthRequiredState({
  description = '当前页面依赖受保护接口。请先点击右上角“配置 Token”，填入 config.toml 里的 auth_token。',
  title = '需要访问凭证'
}: AuthRequiredStateProps) {
  return (
    <Card className="border-warning/25 bg-[linear-gradient(135deg,rgba(214,156,72,0.12),rgba(214,156,72,0.04))]">
      <CardHeader>
        <div className="mb-3 inline-flex size-11 items-center justify-center rounded-2xl border border-warning/20 bg-warning/10 text-warning">
          <ShieldAlert className="size-5" />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline">
          右上角配置 Token
        </Button>
      </CardContent>
    </Card>
  )
}
