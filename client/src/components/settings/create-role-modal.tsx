"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"

interface CreateRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  projectId: string
}

// Predefined color options
const ROLE_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Gray', value: '#6b7280' },
]

export function CreateRoleModal({ open, onOpenChange, onSuccess, projectId }: CreateRoleModalProps) {
  const [roleName, setRoleName] = useState("")
  const [selectedColor, setSelectedColor] = useState(ROLE_COLORS[6].value) // Default to Gray
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Reset form when modal closes
  const handleClose = () => {
    if (!isCreating) {
      setRoleName("")
      setSelectedColor(ROLE_COLORS[6].value)
      setShowConfirmDialog(false)
      onOpenChange(false)
    }
  }

  const handleCreateClick = () => {
    // Validate role name
    if (!roleName.trim()) {
      toast.error('Role name is required')
      return
    }

    // Open confirmation dialog instead of creating immediately
    setShowConfirmDialog(true)
  }

  const handleConfirmCreate = async () => {
    if (!roleName.trim()) {
      toast.error('Role name is required')
      return
    }

    setIsCreating(true)

    try {
      await projectsAPI.createRole(projectId, {
        name: roleName.trim(),
        color: selectedColor,
      })

      toast.success('Role created successfully')
      
      // Close both dialogs
      setShowConfirmDialog(false)
      handleClose()
      
      // Refresh roles list
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Failed to create role:', error)
      toast.error(error.response?.data?.message || 'Failed to create role')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      {/* Main Create Role Dialog */}
      <Dialog open={open && !showConfirmDialog} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Role</DialogTitle>
            <DialogDescription>
              Create a custom role with specific permissions for your project
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Role Name Input */}
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                placeholder="e.g., Contributor, Manager, Viewer"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                disabled={isCreating}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                Choose a unique name for this role
              </p>
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-3 flex-wrap">
                {ROLE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    disabled={isCreating}
                    className={`
                      relative h-10 w-10 rounded-full border-2 transition-all
                      ${selectedColor === color.value
                        ? 'border-foreground scale-110 ring-2 ring-foreground/20'
                        : 'border-border hover:border-foreground/50 hover:scale-105'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    style={{ backgroundColor: color.value }}
                    aria-label={`Select ${color.name} color`}
                  >
                    {selectedColor === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-3 w-3 rounded-full bg-background border border-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Select a color to identify this role
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateClick}
              disabled={isCreating || !roleName.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              Create Role
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={(open) => {
        if (!isCreating) {
          setShowConfirmDialog(open)
        }
      }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Role Creation</DialogTitle>
            <DialogDescription>
              Are you sure you want to create the role "{roleName}"?
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCreate}
              disabled={isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreating ? 'Creating...' : 'Create Role'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

