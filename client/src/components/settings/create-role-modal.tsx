"use client"

import { useState, useEffect } from "react"
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
  editingRole?: { name: string; currentRate?: number } | null
  onUpdateRate?: (roleName: string, currentRate: number) => void
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

export function CreateRoleModal({ open, onOpenChange, onSuccess, projectId, editingRole, onUpdateRate }: CreateRoleModalProps) {
  const isEditMode = !!editingRole
  const [roleName, setRoleName] = useState(editingRole?.name || "")
  const [selectedColor, setSelectedColor] = useState(ROLE_COLORS[6].value) // Default to Gray
  const [currentRate, setCurrentRate] = useState(editingRole?.currentRate?.toString() || "")
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Reset form when modal closes
  const handleClose = () => {
    if (!isCreating) {
      if (!isEditMode) {
        setRoleName("")
        setSelectedColor(ROLE_COLORS[6].value)
        setCurrentRate("")
      } else {
        // Reset to editing role values
        setRoleName(editingRole?.name || "")
        setCurrentRate(editingRole?.currentRate?.toString() || "")
      }
      setShowConfirmDialog(false)
      onOpenChange(false)
    }
  }

  // Update form when editingRole changes
  useEffect(() => {
    if (editingRole) {
      setRoleName(editingRole.name || "")
      setCurrentRate(editingRole.currentRate?.toString() || "")
    }
  }, [editingRole])

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

    const rateNum = parseFloat(currentRate)
    if (isNaN(rateNum) || rateNum < 0) {
      toast.error('Please enter a valid non-negative rate')
      return
    }

    setIsCreating(true)

    try {
      if (isEditMode && onUpdateRate) {
        // Update existing role rate
        await onUpdateRate(roleName.trim(), rateNum)
        setShowConfirmDialog(false)
        handleClose()
      } else {
        // Create new role
        await projectsAPI.createRole(projectId, {
          name: roleName.trim(),
          color: selectedColor,
          currentRate: rateNum,
        })

        toast.success('Role created successfully')
        
        // Close both dialogs
        setShowConfirmDialog(false)
        handleClose()
        
        // Refresh roles list
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (error: any) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} role:`, error)
      toast.error(error.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} role`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <>
      {/* Main Create/Edit Role Dialog */}
      <Dialog open={open && !showConfirmDialog} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Role Rate' : 'Create New Role'}</DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? `Update the monthly salary for role "${editingRole?.name}"`
                : 'Create a custom role with specific permissions for your project'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Role Name Input - Disabled in edit mode */}
            {!isEditMode && (
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
            )}

            {/* Rate Input */}
            <div className="space-y-2">
              <Label htmlFor="role-rate">Monthly Salary ($)</Label>
              <Input
                id="role-rate"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g., 5000"
                value={currentRate}
                onChange={(e) => setCurrentRate(e.target.value)}
                disabled={isCreating}
              />
              <p className="text-xs text-muted-foreground">
                System automatically calculates hourly rates based on project schedule.
              </p>
            </div>

            {/* Color Picker - Hidden in edit mode */}
            {!isEditMode && (
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
            )}
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
              disabled={isCreating || (!isEditMode && !roleName.trim())}
              className="bg-primary hover:bg-primary/90"
            >
              {isEditMode ? 'Update Rate' : 'Create Role'}
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
            <DialogTitle>{isEditMode ? 'Confirm Rate Update' : 'Confirm Role Creation'}</DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? `Are you sure you want to update the rate for role "${roleName}" to $${currentRate}?`
                : `Are you sure you want to create the role "${roleName}"?`}
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
              {isCreating 
                ? (isEditMode ? 'Updating...' : 'Creating...') 
                : (isEditMode ? 'Update Rate' : 'Create Role')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

