import { useState } from 'react'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog'

type ConfirmationDialogProps = {
  cancelLabel?: string
  confirmLabel?: string
  description: string
  onConfirm: () => Promise<void> | void
  onOpenChange: (open: boolean) => void
  open: boolean
  title: string
  tone?: 'danger' | 'default'
}

export function ConfirmationDialog({
  cancelLabel = '取消',
  confirmLabel = '确认',
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  tone = 'default'
}: ConfirmationDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)

    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (submitting) {
          return
        }

        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="w-[min(92vw,480px)]">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={tone === 'danger' ? 'danger' : 'default'}
            onClick={() => void handleConfirm()}
            disabled={submitting}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
