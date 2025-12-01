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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users } from "lucide-react"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"

interface CreateDepartmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSuccess?: () => void
}

export function CreateDepartmentModal({
  open,
  onOpenChange,
  projectId,
  onSuccess,
}: CreateDepartmentModalProps) {
  const [name, setName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a department name')
      return
    }

    setIsCreating(true)

    try {
      await projectsAPI.createDepartment(projectId, name.trim())
      toast.success(`Department "${name.trim()}" created successfully`)
      setName("")
      onOpenChange(false)
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Failed to create department:', error)
      toast.error(error.response?.data?.message || 'Failed to create department')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Create Department
          </DialogTitle>
          <DialogDescription>
            Create a new organizational group for your team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="dept-name">Department Name *</Label>
            <Input
              id="dept-name"
              placeholder="e.g., Marketing, Development, Design..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim() && !isCreating) {
                  handleCreate()
                }
              }}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setName("")
              onOpenChange(false)
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Department'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

