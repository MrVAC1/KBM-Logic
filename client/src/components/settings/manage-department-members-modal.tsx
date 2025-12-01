"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, UserPlus, UserMinus } from "lucide-react"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"
import { format } from "date-fns"

interface ProjectMember {
  _id: string
  userId: string
  uid: string
  email: string
  displayName: string
  avatar: string
  roleName: string
  roles?: string[]
  joinedAt: string
  activeTaskCount: number
  isOwner: boolean
}

interface ManageDepartmentMembersModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  departmentId: string
  departmentName: string
  departmentMemberIds: string[]
  onSuccess?: () => void
}

export function ManageDepartmentMembersModal({
  open,
  onOpenChange,
  projectId,
  departmentId,
  departmentName,
  departmentMemberIds,
  onSuccess,
}: ManageDepartmentMembersModalProps) {
  const [allMembers, setAllMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null)
  // Local state for department member IDs (for optimistic updates)
  const [currentDepartmentMemberIds, setCurrentDepartmentMemberIds] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      // Initialize department member IDs from props (normalize to strings for consistent comparison)
      setCurrentDepartmentMemberIds(
        departmentMemberIds.map(id => id?.toString() || id).filter(Boolean)
      )
      fetchAllMembers()
    } else {
      // Reset state when modal closes
      setCurrentDepartmentMemberIds([])
      setAllMembers([])
    }
  }, [open, projectId, departmentMemberIds])

  const fetchAllMembers = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      const response = await projectsAPI.getMembers(projectId)
      const data = response.data?.data || response.data
      setAllMembers(data.members || [])
    } catch (error: any) {
      console.error('Failed to fetch members:', error)
      toast.error(error.response?.data?.message || 'Failed to load members')
      setAllMembers([])
    } finally {
      setLoading(false)
    }
  }

  // Helper to normalize ID to string for consistent comparison
  const normalizeId = (id: string | undefined | null): string | null => {
    if (!id) return null
    return id.toString().trim()
  }

  const isMemberInDepartment = (userId: string | undefined | null): boolean => {
    const normalizedUserId = normalizeId(userId)
    if (!normalizedUserId) return false
    
    // departmentMemberIds contains User._id values (ObjectId or string)
    // Normalize all IDs to strings for consistent comparison
    return currentDepartmentMemberIds.some(deptMemberId => {
      const normalizedDeptId = normalizeId(deptMemberId)
      return normalizedDeptId === normalizedUserId
    })
  }

  // Filter members: Separate into current members and available to add
  // Note: departmentMemberIds contains User._id, so we compare against member.userId
  const currentMembers = allMembers.filter(member => {
    // Use userId (User._id) for comparison - this is what's stored in department.memberIds
    return member.userId && isMemberInDepartment(member.userId)
  })

  const availableMembers = allMembers.filter(member => {
    // Use userId (User._id) for comparison - only show members NOT in department
    // Explicitly exclude members that are already in the department
    return member.userId && !isMemberInDepartment(member.userId)
  })

  const handleToggleMember = async (member: ProjectMember) => {
    // Use userId for API calls (department stores User._id, not member document _id)
    // userId is required, but fallback to _id for safety
    if (!member.userId) {
      toast.error('Invalid member data: missing userId')
      return
    }
    
    const userId = member.userId
    const isInDepartment = isMemberInDepartment(userId)

    setUpdatingMemberId(userId)

    // Optimistic update: Update local state immediately
    const normalizedUserId = normalizeId(userId)
    if (!normalizedUserId) {
      toast.error('Invalid user ID')
      return
    }

    if (isInDepartment) {
      // Remove from department (optimistic)
      setCurrentDepartmentMemberIds(prev => 
        prev.filter(id => normalizeId(id) !== normalizedUserId)
      )
    } else {
      // Add to department (optimistic) - ensure we add the normalized ID
      setCurrentDepartmentMemberIds(prev => {
        // Check if already exists to prevent duplicates
        const exists = prev.some(id => normalizeId(id) === normalizedUserId)
        return exists ? prev : [...prev, normalizedUserId]
      })
    }

    try {
      if (isInDepartment) {
        await projectsAPI.removeMemberFromDepartment(projectId, departmentId, userId)
        toast.success(`${member.displayName} removed from department`)
      } else {
        await projectsAPI.addMemberToDepartment(projectId, departmentId, userId)
        toast.success(`${member.displayName} added to department`)
      }

      // Refresh department details (to sync with backend)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('Failed to update department member:', error)
      toast.error(error.response?.data?.message || 'Failed to update department member')
      
      // Revert optimistic update on error
      const normalizedUserId = normalizeId(userId)
      if (normalizedUserId) {
        if (isInDepartment) {
          // Re-add the member (revert removal)
          setCurrentDepartmentMemberIds(prev => {
            const exists = prev.some(id => normalizeId(id) === normalizedUserId)
            return exists ? prev : [...prev, normalizedUserId]
          })
        } else {
          // Remove the member (revert addition)
          setCurrentDepartmentMemberIds(prev => 
            prev.filter(id => normalizeId(id) !== normalizedUserId)
          )
        }
      }
    } finally {
      setUpdatingMemberId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Manage {departmentName} Members
          </DialogTitle>
          <DialogDescription>
            Add or remove members from this department
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading members...</p>
          </div>
        ) : allMembers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No members found</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* Current Members Section */}
            {currentMembers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Current Members ({currentMembers.length})</h3>
                </div>
                {currentMembers.map((member) => {
                  const userId = member.userId || member._id
                  const isUpdating = updatingMemberId === userId

                  return (
                    <div
                      key={userId}
                      className="flex items-center justify-between p-4 rounded-lg border transition-colors bg-primary/5 border-primary/30"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.displayName} />
                          <AvatarFallback className="text-xs">
                            {member.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{member.displayName}</p>
                          <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {member.roleName}
                            </Badge>
                            {member.activeTaskCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {member.activeTaskCount} active tasks
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleToggleMember(member)}
                        disabled={isUpdating || member.isOwner}
                        className="ml-4 flex-shrink-0"
                      >
                        {isUpdating ? (
                          'Removing...'
                        ) : (
                          <>
                            <UserMinus className="h-4 w-4 mr-2" />
                            Remove
                          </>
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Available Members Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">Available to Add ({availableMembers.length})</h3>
              </div>
              {availableMembers.length === 0 ? (
                <div className="flex items-center justify-center py-8 rounded-lg border border-border bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    {currentMembers.length > 0 
                      ? "All project members are already in this team."
                      : "No members available to add."
                    }
                  </p>
                </div>
              ) : (
                availableMembers.map((member) => {
                  const userId = member.userId || member._id
                  const isUpdating = updatingMemberId === userId

                  return (
                    <div
                      key={userId}
                      className="flex items-center justify-between p-4 rounded-lg border transition-colors bg-card border-border hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarImage src={member.avatar || "/placeholder.svg"} alt={member.displayName} />
                          <AvatarFallback className="text-xs">
                            {member.displayName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{member.displayName}</p>
                          <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {member.roleName}
                            </Badge>
                            {member.activeTaskCount > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {member.activeTaskCount} active tasks
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleToggleMember(member)}
                        disabled={isUpdating || member.isOwner}
                        className="ml-4 flex-shrink-0"
                      >
                        {isUpdating ? (
                          'Adding...'
                        ) : (
                          <>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

