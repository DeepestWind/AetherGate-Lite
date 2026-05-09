import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useSessionStore } from '@/shared/stores/use-session-store'

type SettingsDialogProps = {
  onOpenChange: (open: boolean) => void
  open: boolean
}

export function SettingsDialog({ onOpenChange, open }: SettingsDialogProps) {
  const { clearToken, setToken, token } = useSessionStore()
  const [draft, setDraft] = useState(token)

  useEffect(() => {
    if (open) {
      setDraft(token)
    }
  }, [open, token])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>访问凭证</DialogTitle>
          <DialogDescription>
            管理接口和内部观测接口都需要 Bearer Token。这里的值只保存在当前浏览器。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label htmlFor="console-token" className="text-sm font-medium text-ink">
            Bearer Token
          </label>
          <Input
            id="console-token"
            type="password"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="请输入 config.toml 中的 auth_token"
          />
        </div>

        <DialogFooter className="border-t border-rule pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clearToken()
              setDraft('')
            }}
          >
            清空
          </Button>
          <Button
            type="button"
            onClick={() => {
              setToken(draft)
              onOpenChange(false)
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
