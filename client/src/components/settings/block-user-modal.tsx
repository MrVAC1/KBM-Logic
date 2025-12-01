"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { AlertTriangle } from "lucide-react"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"

interface BlockUserModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  userId: string
  userName: string
  onBlocked?: () => void
}

export function BlockUserModal({
  open,
  onOpenChange,
  projectId,
  userId,
  userName,
  onBlocked,
}: BlockUserModalProps) {
  const [reason, setReason] = useState("")
  const [isBlocking, setIsBlocking] = useState(false)

  const handleBlock = async () => {
    if (!reason.trim()) {
      toast.error('Please provide a reason for blocking')
      return
    }

    setIsBlocking(true)

    try {
      await projectsAPI.blockMember(projectId, userId, reason.trim())
      toast.success(`User "${userName}" has been blocked`)
      setReason("")
      onOpenChange(false)
      
      if (onBlocked) {
        onBlocked()
      }
    } catch (error: any) {
      console.error('Failed to block user:', error)
      toast.error(error.response?.data?.message || 'Failed to block user')
    } finally {
      setIsBlocking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Block User
          </DialogTitle>
          <DialogDescription>
            Block <strong>{userName}</strong> from accessing this project. They will be removed from all departments and cannot rejoin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="block-reason">Reason for blocking *</Label>
            <Textarea
              id="block-reason"
              placeholder="e.g., Violated project guidelines, Inappropriate behavior..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This reason will be visible to the blocked user if they attempt to rejoin.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setReason("")
              onOpenChange(false)
            }}
            disabled={isBlocking}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleBlock}
            disabled={isBlocking || !reason.trim()}
          >
            {isBlocking ? 'Blocking...' : 'Block User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

