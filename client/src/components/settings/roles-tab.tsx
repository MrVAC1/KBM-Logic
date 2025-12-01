"use client"

import { useState, useEffect, useCallback } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Shield, Lock, ChevronDown, ChevronUp, GripVertical } from "lucide-react"
import { projects as projectsAPI } from "@/services/api"
import { useProject } from "@/contexts/ProjectContext"
import { toast } from "sonner"

// Map all available permissions to user-friendly labels
const permissionLabels: Record<string, { label: string; description: string }> = {
  'can_view_dashboard': {
    label: 'View Dashboard',
    description: 'Access the project dashboard with overview statistics'
  },
  'can_view_tasks': {
    label: 'View Tasks',
    description: 'See and browse tasks in the Kanban board'
  },
  'can_view_risks': {
    label: 'View Risks',
    description: 'Access risk assessments and risk scores'
  },
  'can_view_financial': {
    label: 'View Financial',
    description: 'View budget, transactions, and financial reports'
  },
  'can_track_time': {
    label: 'Track Time',
    description: 'Log time on tasks and track work hours'
  },
  'can_create_tasks': {
    label: 'Create Tasks',
    description: 'Create new tasks in the project'
  },
  'can_edit_tasks': {
    label: 'Edit Tasks',
    description: 'Modify existing tasks'
  },
  'can_delete_tasks': {
    label: 'Delete Tasks',
    description: 'Remove tasks from the project'
  },
  'can_edit_budget': {
    label: 'Edit Budget',
    description: 'Manage project finances and transactions'
  },
  'can_manage_roles': {
    label: 'Manage Roles',
    description: 'Create and modify user roles and permissions'
  },
  'can_invite_users': {
    label: 'Invite Users',
    description: 'Invite new members to the project'
  },
  'can_manage_settings': {
    label: 'Manage Settings',
    description: 'Modify project settings and configuration'
  },
  'can_delete_project': {
    label: 'Delete Project',
    description: 'Permanently delete the project'
  },
}

// Critical permissions that cannot be disabled for Owner role
const CRITICAL_PERMISSIONS = ['can_edit_budget', 'can_manage_roles', 'can_delete_project']

interface Role {
  name: string
  permissions: string[]
  hierarchy: number
  color: string
  isOwner?: boolean
}

// Separate RoleCard component with isolated expand/collapse state
interface RoleCardProps {
  role: Role
  allPermissions: string[]
  permissionLabels: Record<string, { label: string; description: string }>
  updatingPermissions: Set<string>
  onPermissionToggle: (roleName: string, permissionId: string, newValue: boolean) => void
  isDraggable?: boolean
}

function RoleCard({ role, allPermissions, permissionLabels, updatingPermissions, onPermissionToggle, isDraggable = false }: RoleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: role.name,
    disabled: !isDraggable,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsExpanded(prev => !prev)
  }

  return (
    <Card 
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: role.color }}
      className="border-l-4"
    >
      <CardContent className="py-4">
        <div className="space-y-4">
          {/* Role Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Drag Handle - only show for draggable roles */}
              {isDraggable && (
                <button
                  type="button"
                  {...attributes}
                  {...listeners}
                  className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={`Drag to reorder ${role.name} role`}
                >
                  <GripVertical className="h-5 w-5" />
                </button>
              )}
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: role.color }} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{role.name}</h3>
                  {role.isOwner && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      <Shield className="h-3 w-3 mr-1" />
                      Owner
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Hierarchy Level {role.hierarchy}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToggleExpand}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? `Collapse ${role.name} permissions` : `Expand ${role.name} permissions`}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Permissions (Expanded) */}
          {isExpanded && (
            <div className="space-y-3 pt-4 border-t border-border">
              <h4 className="text-sm font-medium">Permissions</h4>
              {allPermissions.map((permissionId) => {
                const permissionInfo = permissionLabels[permissionId]
                const isEnabled = role.permissions.includes(permissionId)
                const isCritical = CRITICAL_PERMISSIONS.includes(permissionId)
                const isLocked = role.isOwner && isCritical && isEnabled
                const updateKey = `${role.name}-${permissionId}`
                const isUpdating = updatingPermissions.has(updateKey)

                return (
                  <div
                    key={permissionId}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isLocked ? "bg-muted/50 border-primary/50" : "bg-card border-border"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label htmlFor={`${role.name}-${permissionId}`}>
                          {permissionInfo?.label || permissionId}
                        </Label>
                        {isLocked && <Lock className="h-3 w-3 text-primary" />}
                        {isUpdating && (
                          <span className="text-xs text-muted-foreground">Updating...</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {permissionInfo?.description || 'No description available'}
                      </p>
                      {isLocked && (
                        <p className="text-xs text-primary mt-1">
                          Critical permission: Cannot be disabled for Owner role
                        </p>
                      )}
                    </div>
                    <Switch
                      id={`${role.name}-${permissionId}`}
                      checked={isEnabled}
                      disabled={isLocked || isUpdating}
                      onCheckedChange={(checked) => {
                        onPermissionToggle(role.name, permissionId, checked)
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function RolesTab() {
  const { currentProject } = useProject()
  const projectId = currentProject?.id || currentProject?._id
  
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingPermissions, setUpdatingPermissions] = useState<Set<string>>(new Set())
  const [isReordering, setIsReordering] = useState(false)

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Fetch roles from backend
  const fetchRoles = useCallback(async () => {
    if (!projectId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await projectsAPI.getRoles(projectId)
      const rolesData = response.data?.data?.roles || response.data?.roles || []
      
      // Transform backend roles to match frontend structure
      const transformedRoles = rolesData.map((role: any) => ({
        name: role.name,
        permissions: Array.isArray(role.permissions) ? role.permissions : [],
        hierarchy: role.hierarchy || 100,
        color: role.color || '#6b7280',
        isOwner: role.name === 'Owner',
      }))
      
      setRoles(transformedRoles)
    } catch (error: any) {
      console.error('Failed to fetch roles:', error)
      toast.error(error.response?.data?.message || 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  // Handle permission toggle with optimistic UI
  const handlePermissionToggle = async (roleName: string, permissionId: string, newValue: boolean) => {
    if (!projectId) {
      toast.error('Project ID not found')
      return
    }

    const role = roles.find(r => r.name === roleName)
    if (!role) {
      toast.error('Role not found')
      return
    }

    const currentPermissions = role.permissions || []
    const currentlyEnabled = currentPermissions.includes(permissionId)
    
    // Lock check - Owner role critical permissions cannot be disabled
    if (role.isOwner && CRITICAL_PERMISSIONS.includes(permissionId) && currentlyEnabled && !newValue) {
      toast.error('Critical permissions cannot be disabled for Owner role')
      return
    }

    // If state isn't actually changing, do nothing
    if (currentlyEnabled === newValue) {
      return
    }

    // Calculate new permissions
    const newPermissions = newValue
      ? [...currentPermissions, permissionId]
      : currentPermissions.filter(p => p !== permissionId)

    // Save previous state for rollback
    const previousRoles = [...roles]

    // Create update key for tracking
    const updateKey = `${roleName}-${permissionId}`
    setUpdatingPermissions(prev => new Set(prev).add(updateKey))

    // OPTIMISTIC UPDATE: Update state immediately for instant UI feedback
    setRoles(prevRoles =>
      prevRoles.map(r =>
        r.name === roleName
          ? { ...r, permissions: newPermissions }
          : r
      )
    )

    try {
      await projectsAPI.updateRolePermissions(projectId, roleName, newPermissions)
      toast.success(`Permission ${newValue ? 'granted' : 'removed'} successfully`)
    } catch (error: any) {
      console.error('Failed to update permission:', error)
      // REVERT: Rollback to previous state on error
      setRoles(previousRoles)
      toast.error(error.response?.data?.message || 'Failed to update permission')
    } finally {
      setUpdatingPermissions(prev => {
        const newSet = new Set(prev)
        newSet.delete(updateKey)
        return newSet
      })
    }
  }

  // Handle drag end - update role order
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    if (!projectId) {
      toast.error('Project ID not found')
      return
    }

    // Separate Owner role from other roles
    const ownerRole = roles.find(r => r.isOwner)
    const otherRoles = roles.filter(r => !r.isOwner)

    // Find the indices
    const oldIndex = otherRoles.findIndex(r => r.name === active.id)
    const newIndex = otherRoles.findIndex(r => r.name === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Reorder the other roles
    const reorderedRoles = arrayMove(otherRoles, oldIndex, newIndex)

    // Combine: Owner first, then reordered roles
    const newRolesOrder = ownerRole ? [ownerRole, ...reorderedRoles] : reorderedRoles

    // Save previous state for rollback
    const previousRoles = [...roles]

    // OPTIMISTIC UPDATE: Update state immediately
    setRoles(newRolesOrder)
    setIsReordering(true)

    try {
      // Extract role names in new order
      const roleOrder = newRolesOrder.map(r => r.name)
      
      // Call API to update order
      await projectsAPI.updateRoleOrder(projectId, roleOrder)
      
      toast.success('Role order updated successfully')
    } catch (error: any) {
      console.error('Failed to update role order:', error)
      
      // REVERT: Rollback to previous state on error
      setRoles(previousRoles)
      
      toast.error(error.response?.data?.message || 'Failed to update role order')
    } finally {
      setIsReordering(false)
    }
  }

  // Get all available permissions (sorted for consistent display)
  const allPermissions = Object.keys(permissionLabels).sort()

  // Separate Owner role from other roles
  const ownerRole = roles.find(r => r.isOwner)
  const otherRoles = roles.filter(r => !r.isOwner)
  const sortableRoleIds = otherRoles.map(r => r.name)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading roles...</p>
      </div>
    )
  }

  if (roles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No roles found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Role Management</CardTitle>
          <CardDescription>Discord-style hierarchical roles with granular permissions. Drag roles to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="space-y-3">
              {/* Owner Role - Pinned at top, not draggable */}
              {ownerRole && (
                <RoleCard
                  key={ownerRole.name}
                  role={ownerRole}
                  allPermissions={allPermissions}
                  permissionLabels={permissionLabels}
                  updatingPermissions={updatingPermissions}
                  onPermissionToggle={handlePermissionToggle}
                  isDraggable={false}
                />
              )}

              {/* Other Roles - Sortable */}
              <SortableContext
                items={sortableRoleIds}
                strategy={verticalListSortingStrategy}
              >
                {otherRoles.map((role) => (
                  <RoleCard
                    key={role.name}
                    role={role}
                    allPermissions={allPermissions}
                    permissionLabels={permissionLabels}
                    updatingPermissions={updatingPermissions}
                    onPermissionToggle={handlePermissionToggle}
                    isDraggable={true}
                  />
                ))}
              </SortableContext>
            </div>
          </DndContext>
          
          {isReordering && (
            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">Updating role order...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
