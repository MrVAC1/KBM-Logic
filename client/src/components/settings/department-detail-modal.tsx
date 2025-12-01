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
import { X, Users } from "lucide-react"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"
import { format } from "date-fns"

interface DepartmentMember {
  _id: string
  id: string
  uid: string
  email: string
  displayName: string
  avatar: string
  joinedAt: string
  activeTaskCount: number
}

interface DepartmentDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  departmentId: string | null
  departmentName: string
  onMemberRemoved?: () => void
}

export function DepartmentDetailModal({
  open,
  onOpenChange,
  projectId,
  departmentId,
  departmentName,
  onMemberRemoved,
}: DepartmentDetailModalProps) {
  const [members, setMembers] = useState<DepartmentMember[]>([])
  const [loading, setLoading] = useState(true)
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)

  useEffect(() => {
    if (open && departmentId) {
      fetchDepartmentDetails()
    } else {
      setMembers([])
    }
  }, [open, departmentId, projectId])

  const fetchDepartmentDetails = async () => {
    if (!departmentId || !projectId) return

    try {
      setLoading(true)
      const response = await projectsAPI.getDepartmentDetails(projectId, departmentId)
      const data = response.data?.data || response.data
      setMembers(data.members || [])
    } catch (error: any) {
      console.error('Failed to fetch department details:', error)
      toast.error(error.response?.data?.message || 'Failed to load department details')
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!departmentId || !projectId) return

    setRemovingMemberId(memberId)

    try {
      await projectsAPI.removeMemberFromDepartment(projectId, departmentId, memberId)
      toast.success('Member removed from department')
      
      // Refresh members list
      await fetchDepartmentDetails()
      
      // Notify parent
      if (onMemberRemoved) {
        onMemberRemoved()
      }
    } catch (error: any) {
      console.error('Failed to remove member:', error)
      toast.error(error.response?.data?.message || 'Failed to remove member from department')
    } finally {
      setRemovingMemberId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {departmentName}
          </DialogTitle>
          <DialogDescription>
            Manage members in this department
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading members...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">No members in this department</p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {members.map((member) => (
              <div
                key={member._id || member.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border bg-card"
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
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="flex-shrink-0">
                    {member.activeTaskCount} active tasks
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveMember(member._id || member.id)}
                  disabled={removingMemberId === (member._id || member.id)}
                  className="ml-4 flex-shrink-0"
                >
                  {removingMemberId === (member._id || member.id) ? (
                    'Removing...'
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

