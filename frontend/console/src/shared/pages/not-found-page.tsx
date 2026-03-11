import { Link } from 'react-router'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="text-3xl">页面不存在</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>这个路由还没有被接入到新的 React 控制台，或者地址本身不正确。</p>
          <Button asChild>
            <Link to="/dashboard">返回 Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
