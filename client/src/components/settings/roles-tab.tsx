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
import { Shield, Lock, ChevronDown, ChevronUp, GripVertical, Trash2, Plus } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { CreateRoleModal } from "./create-role-modal"
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
  onDelete?: (roleName: string) => void
  isDraggable?: boolean
  userPermissions?: string[]
  isOwner?: boolean
  isDeleting?: boolean
}

function RoleCard({ role, allPermissions, permissionLabels, updatingPermissions, onPermissionToggle, onDelete, isDraggable = false, userPermissions = [], isOwner = false, isDeleting = false }: RoleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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

  // Permission categories (defined inside component to avoid scope issues)
  const criticalPermissions = [
    'can_delete_project',
    'can_manage_settings',
    'can_manage_roles',
    'can_edit_budget',
  ]
  
  const managementPermissions = [
    'can_invite_users',
    'can_delete_tasks',
  ]
  
  const operationalPermissions = [
    'can_create_tasks',
    'can_edit_tasks',
    'can_track_time',
  ]
  
  const viewPermissions = [
    'can_view_financial',
    'can_view_risks',
    'can_view_dashboard',
    'can_view_tasks',
  ]

  return (
    <div
      ref={setNodeRef}
      style={style}
    >
      <Card 
        style={{ borderLeftColor: role.color }}
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
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="text-sm font-medium">Permissions</h4>
              
              {/* Render permission groups */}
              {[
                { title: 'Administration', permissions: criticalPermissions },
                { title: 'Management', permissions: managementPermissions },
                { title: 'Operations', permissions: operationalPermissions },
                { title: 'Access', permissions: viewPermissions },
              ].map((group) => (
                <div key={group.title} className="space-y-2">
                  <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{group.title}</h5>
                  {group.permissions.map((permissionId) => {
                    const permissionInfo = permissionLabels[permissionId]
                    const isEnabled = role.permissions.includes(permissionId)
                    const isCritical = CRITICAL_PERMISSIONS.includes(permissionId)
                    const isLocked = role.isOwner && isCritical && isEnabled
                    
                    // Hard limit: can_delete_project is ONLY for Owner
                    const isOwnerOnly = permissionId === 'can_delete_project'
                    const isDeleteProjectDisabled = isOwnerOnly && !role.isOwner
                    
                    // Check if user has this permission (hierarchy rule)
                    const userHasPermission = isOwner || userPermissions.includes(permissionId)
                    const isDisabledByHierarchy = !userHasPermission && !isOwner
                    const updateKey = `${role.name}-${permissionId}`
                    const isUpdating = updatingPermissions.has(updateKey)
                    
                    // Final disabled state
                    const isDisabled = isLocked || isUpdating || isDisabledByHierarchy || isDeleteProjectDisabled

                    return (
                      <div
                        key={permissionId}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isLocked || isDeleteProjectDisabled ? "bg-muted/50 border-primary/50" : "bg-card border-border"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`${role.name}-${permissionId}`}>
                              {permissionInfo?.label || permissionId}
                            </Label>
                            {isLocked && <Lock className="h-3 w-3 text-primary" />}
                            {isDeleteProjectDisabled && <Lock className="h-3 w-3 text-primary" />}
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
                          {isDeleteProjectDisabled && (
                            <p className="text-xs text-primary mt-1">
                              Reserved for Project Owner
                            </p>
                          )}
                          {isDisabledByHierarchy && !isDeleteProjectDisabled && (
                            <p className="text-xs text-destructive mt-1">
                              You cannot grant this permission because you don't have it yourself
                            </p>
                          )}
                        </div>
                        <Switch
                          id={`${role.name}-${permissionId}`}
                          checked={isDeleteProjectDisabled ? false : isEnabled}
                          disabled={isDisabled}
                          onCheckedChange={(checked) => {
                            // Prevent toggling if it's delete_project and not Owner
                            if (isOwnerOnly && !role.isOwner) {
                              return
                            }
                            onPermissionToggle(role.name, permissionId, checked)
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Delete Role Button - in expanded footer */}
          {/* Hide for Owner (protected) and Guest (default system role) */}
          {isExpanded && onDelete && !role.isOwner && role.name !== 'Guest' && (
            <div className="pt-4 mt-4 border-t border-border">
              <Button
                type="button"
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowDeleteDialog(true)
                }}
                className="w-full"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete Role'}
              </Button>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                This action cannot be undone. Make sure no members are assigned to this role.
              </p>
            </div>
          )}
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{role.name}"? This action cannot be undone.
              <br />
              <span className="text-destructive font-medium">
                This role will be removed from all members who currently have it assigned.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (onDelete) {
                  onDelete(role.name)
                }
                setShowDeleteDialog(false)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </Card>
    </div>
  )
}

export function RolesTab() {
  const { currentProject, hasPermission, isOwner } = useProject()
  const projectId = currentProject?.id || currentProject?._id
  
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingPermissions, setUpdatingPermissions] = useState<Set<string>>(new Set())
  const [isReordering, setIsReordering] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingRole, setDeletingRole] = useState<string | null>(null)
  
  // Get current user's permissions
  const userPermissions: string[] = []
  Object.keys(permissionLabels).forEach(permission => {
    if (hasPermission(permission)) {
      userPermissions.push(permission)
    }
  })

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
    
    // Hard limit: can_delete_project is ONLY for Owner role
    if (permissionId === 'can_delete_project' && !role.isOwner) {
      toast.error('Delete Project permission is reserved for Project Owner only')
      return
    }
    
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

    // Ensure Owner cannot be dragged (should not happen, but double-check)
    if (active.id === 'Owner' || over.id === 'Owner') {
      toast.error('The Owner role cannot be reordered.')
      return
    }

    // Find the indices
    const oldIndex = otherRoles.findIndex(r => r.name === active.id)
    const newIndex = otherRoles.findIndex(r => r.name === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      return
    }

    // Reorder the other roles
    const reorderedRoles = arrayMove(otherRoles, oldIndex, newIndex)

    // Combine: Owner ALWAYS first at index 0, then reordered roles
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

  // Handle role deletion
  const handleDeleteRole = async (roleName: string) => {
    if (!projectId) {
      toast.error('Project ID not found')
      return
    }

    setDeletingRole(roleName)

    try {
      await projectsAPI.deleteRole(projectId, roleName)
      toast.success(`Role "${roleName}" deleted successfully`)
      
      // Refresh roles list
      await fetchRoles()
    } catch (error: any) {
      console.error('Failed to delete role:', error)
      toast.error(error.response?.data?.message || 'Failed to delete role')
    } finally {
      setDeletingRole(null)
    }
  }

  // Get all available permissions ordered by importance and category
  // Critical / Admin Level (Top Priority)
  const criticalPermissions = [
    'can_delete_project',
    'can_manage_settings',
    'can_manage_roles',
    'can_edit_budget',
  ]
  
  // Management Level
  const managementPermissions = [
    'can_invite_users',
    'can_delete_tasks',
  ]
  
  // Operational Level
  const operationalPermissions = [
    'can_create_tasks',
    'can_edit_tasks',
    'can_track_time',
  ]
  
  // View Level (Least Critical)
  const viewPermissions = [
    'can_view_financial',
    'can_view_risks',
    'can_view_dashboard',
    'can_view_tasks',
  ]
  
  // Combine all permissions in order
  const allPermissions = [
    ...criticalPermissions,
    ...managementPermissions,
    ...operationalPermissions,
    ...viewPermissions,
  ]

  // Separate Owner role from other roles
  const ownerRole = roles.find(r => r.isOwner)
  const otherRoles = roles.filter(r => !r.isOwner)
  const sortableRoleIds = otherRoles.map(r => r.name)
  
  const canManageRoles = hasPermission('can_manage_roles')

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
      <CreateRoleModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onSuccess={fetchRoles}
        projectId={projectId || ''}
      />
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Role Management</CardTitle>
              <CardDescription>Discord-style hierarchical roles with granular permissions. Drag roles to reorder.</CardDescription>
            </div>
            {canManageRoles && (
              <Button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Create Role
              </Button>
            )}
          </div>
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
                  onDelete={canManageRoles ? handleDeleteRole : undefined}
                  isDraggable={false}
                  userPermissions={userPermissions}
                  isOwner={isOwner || false}
                  isDeleting={deletingRole === ownerRole.name}
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
                    onDelete={canManageRoles ? handleDeleteRole : undefined}
                    isDraggable={true}
                    userPermissions={userPermissions}
                    isOwner={isOwner || false}
                    isDeleting={deletingRole === role.name}
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
