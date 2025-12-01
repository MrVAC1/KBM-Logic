"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"
import { Shield } from "lucide-react"

interface Role {
  name: string
  permissions: string[]
  color: string
  isOwner?: boolean
  isDefault?: boolean
}

interface EditMemberRolesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  memberId: string
  memberName: string
  memberAvatar?: string
  currentRoles: string[]
  availableRoles: Role[]
  onSuccess?: () => void
}

export function EditMemberRolesModal({
  open,
  onOpenChange,
  projectId,
  memberId,
  memberName,
  memberAvatar,
  currentRoles,
  availableRoles,
  onSuccess,
}: EditMemberRolesModalProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [rolesLoading, setRolesLoading] = useState(true)

  useEffect(() => {
    if (open) {
      // Initialize with current roles
      setSelectedRoles([...currentRoles])
      setRolesLoading(false)
    }
  }, [open, currentRoles])

  const handleRoleToggle = (roleName: string) => {
    setSelectedRoles(prev => {
      if (prev.includes(roleName)) {
        return prev.filter(r => r !== roleName)
      } else {
        return [...prev, roleName]
      }
    })
  }

  const handleSave = async () => {
    if (selectedRoles.length === 0) {
      toast.error('At least one role must be selected')
      return
    }

    setIsSaving(true)

    try {
      await projectsAPI.updateMemberRole(projectId, memberId, { roles: selectedRoles })
      toast.success('Member roles updated successfully')
      onOpenChange(false)
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Failed to update member roles:', error)
      toast.error(error.response?.data?.message || 'Failed to update member roles')
    } finally {
      setIsSaving(false)
    }
  }

  // Filter out Owner role from available roles (cannot be assigned)
  const assignableRoles = availableRoles.filter(r => r.name !== 'Owner' && !r.isOwner)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={memberAvatar || "/placeholder.svg"} alt={memberName} />
              <AvatarFallback className="text-xs">
                {memberName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div>Edit Roles</div>
              <DialogDescription className="mt-1">
                {memberName}
              </DialogDescription>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="text-base font-semibold mb-3 block">
              Select Roles (Multiple selection allowed)
            </Label>
            <p className="text-sm text-muted-foreground mb-4">
              Permissions will be aggregated from all selected roles
            </p>
            
            {rolesLoading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">Loading roles...</p>
              </div>
            ) : assignableRoles.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">No roles available</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {assignableRoles.map((role) => {
                    const isSelected = selectedRoles.includes(role.name)
                    
                    return (
                      <div
                        key={role.name}
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary/50'
                            : 'bg-card border-border hover:bg-muted/50'
                        }`}
                        onClick={() => handleRoleToggle(role.name)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleRoleToggle(role.name)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: role.color }}
                            />
                            <Label
                              htmlFor={`role-${role.name}`}
                              className="font-semibold cursor-pointer"
                            >
                              {role.name}
                            </Label>
                            {role.isDefault && (
                              <Badge variant="secondary" className="text-xs">
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {role.permissions.length} permission{role.permissions.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            )}
          </div>

          {selectedRoles.length > 0 && (
            <div className="pt-4 border-t border-border">
              <Label className="text-sm font-semibold mb-2 block">Selected Roles:</Label>
              <div className="flex flex-wrap gap-2">
                {selectedRoles.map(roleName => {
                  const role = availableRoles.find(r => r.name === roleName)
                  return (
                    <Badge
                      key={roleName}
                      variant="secondary"
                      className="flex items-center gap-1"
                      style={{ borderLeftColor: role?.color, borderLeftWidth: '3px' }}
                    >
                      {roleName}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || selectedRoles.length === 0}
          >
            {isSaving ? 'Saving...' : 'Save Roles'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

