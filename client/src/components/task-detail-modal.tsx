"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Play, Pause, Clock, DollarSign, AlertTriangle, Users, Trash2 } from "lucide-react"
import type { Task } from "@/lib/mock-data"
import { mockUsers, mockCurrentUser } from "@/lib/mock-data"
import { tasks as tasksAPI } from "@/services/api"
import { useProject } from "@/contexts/ProjectContext"
import { toast } from "sonner"

interface TaskDetailModalProps {
  task: Task | any
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

export function TaskDetailModal({ task, open, onOpenChange, onUpdate }: TaskDetailModalProps) {
  const [viewMode, setViewMode] = useState<"manager" | "developer">("manager")
  const [isTracking, setIsTracking] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const { hasPermission } = useProject()
  
  // Check if user has permission to delete tasks
  const canDelete = hasPermission('can_delete_tasks')

  // Defensive coding: Ensure arrays exist before accessing
  const taskAssignees = Array.isArray(task?.assignees) ? task.assignees : []
  const taskTimeTracking = Array.isArray(task?.timeTracking) ? task.timeTracking : []

  const hasTimeTrackingPermission = mockCurrentUser?.permissions?.includes("can_track_time") || false
  // Use populated assignee data directly from backend
  const assignedUsers = taskAssignees.filter(Boolean).map((assignee: any) => ({
    id: assignee._id || assignee.id,
    displayName: assignee.displayName || assignee.name || assignee.email?.split('@')[0] || 'Deleted User',
    email: assignee.email || '',
    avatar: assignee.avatar || assignee.photoURL || '',
    nickname: assignee.displayName || assignee.name || assignee.email?.split('@')[0] || 'Deleted User',
  }))
  const currentUserTracking = taskTimeTracking.find((t) => t?.userId === mockCurrentUser?.id)

  const totalHours = taskTimeTracking.reduce((sum, t) => sum + (t?.totalHours || 0), 0)
  const hourlyCost = totalHours > 0 ? (task?.actualCost || 0) / totalHours : 0

  const getRiskColor = (prob: number, impact: number) => {
    const score = prob * impact
    if (score >= 15) return "text-destructive"
    if (score >= 10) return "text-warning"
    if (score >= 5) return "text-info"
    return "text-success"
  }

  // Handle task deletion
  const handleDelete = async () => {
    if (!task?._id && !task?.id) {
      toast.error('Task ID not found')
      return
    }

    setIsDeleting(true)
    try {
      const taskId = task._id || task.id
      await tasksAPI.delete(taskId)
      
      toast.success('Task deleted successfully')
      
      // Close modal and refresh tasks
      onOpenChange(false)
      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      console.error('Delete task error:', error)
      toast.error(error.response?.data?.message || 'Failed to delete task')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[90vh] overflow-y-auto overflow-x-hidden" showCloseButton={false}>
        <DialogHeader className="min-w-0">
          <div className="flex items-start justify-between gap-4 min-w-0">
            <div className="flex-1 min-w-0 overflow-hidden">
              <DialogTitle 
                className="text-2xl break-words" 
                style={{ overflowWrap: 'anywhere' as const }}
              >
                {task?.title || "Untitled Task"}
              </DialogTitle>
              <DialogDescription 
                className="mt-2 break-words" 
                style={{ overflowWrap: 'anywhere' as const }}
              >
                {task?.description || "No description"}
              </DialogDescription>
            </div>
            <Badge
              variant="outline"
              className={`flex-shrink-0 ${
                task?.complexity === "low"
                  ? "bg-success/10 text-success border-success"
                  : task?.complexity === "medium"
                    ? "bg-warning/10 text-warning border-warning"
                    : "bg-destructive/10 text-destructive border-destructive"
              }`}
            >
              {task?.complexity || "medium"} complexity
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between">
            <Label>View Mode:</Label>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as "manager" | "developer")}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager View</SelectItem>
                <SelectItem value="developer">Developer View</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assigned Users */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assigned To:
            </Label>
            <div className="flex flex-wrap gap-2">
              {assignedUsers.length > 0 ? (
                assignedUsers.map((user) => (
                  <div
                    key={user.id || user.email || Math.random()}
                    className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.displayName || user.nickname} />
                      <AvatarFallback className="text-xs">{(user.displayName || user.nickname || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.displayName || user.nickname}</span>
                  </div>
                ))
              ) : task.department ? (
                <Badge variant="secondary">{task.department} Department</Badge>
              ) : (
                <p className="text-sm text-muted-foreground">Unassigned</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Time Tracking Section (Permission Required) */}
          {hasTimeTrackingPermission && (
            <>
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Tracking
                </Label>
                <Card className="border-primary/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Your Time</p>
                        <p className="text-2xl font-bold">{currentUserTracking?.totalHours || 0}h</p>
                      </div>
                      <Button
                        size="lg"
                        variant={isTracking ? "destructive" : "default"}
                        onClick={() => setIsTracking(!isTracking)}
                      >
                        {isTracking ? (
                          <>
                            <Pause className="mr-2 h-5 w-5" />
                            Stop Tracking
                          </>
                        ) : (
                          <>
                            <Play className="mr-2 h-5 w-5" />
                            Start Tracking
                          </>
                        )}
                      </Button>
                    </div>
                    {viewMode === "manager" && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">Cost Calculation</p>
                        <p className="text-lg font-bold text-primary">
                          ${(task?.actualCost || 0).toLocaleString()} ({totalHours}h × ${hourlyCost.toFixed(2)}/h)
                        </p>
                      </div>
                    )}
                    {viewMode === "developer" && (
                      <p className="mt-4 text-xs text-muted-foreground">
                        Other team members' earnings are hidden in developer view
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
              <Separator />
            </>
          )}

          {/* Financial Stats (Manager View) */}
          {viewMode === "manager" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Estimated Cost</span>
                    </div>
                    <p className="text-2xl font-bold">${(task?.estimatedCost || 0).toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Actual Cost</span>
                    </div>
                    <p
                      className={`text-2xl font-bold ${(task?.actualCost || 0) > (task?.estimatedCost || 0) ? "text-destructive" : "text-foreground"}`}
                    >
                      ${(task?.actualCost || 0).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <Separator />
            </>
          )}

          {/* Risk Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Risk Assessment
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Probability (1-5)</p>
                <Select value={(task?.riskProbability || 1).toString()} onValueChange={() => {}}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} -{" "}
                        {n === 1 ? "Very Low" : n === 2 ? "Low" : n === 3 ? "Medium" : n === 4 ? "High" : "Very High"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Impact (1-5)</p>
                <Select value={(task?.riskImpact || 1).toString()} onValueChange={() => {}}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} -{" "}
                        {n === 1
                          ? "Minimal"
                          : n === 2
                            ? "Minor"
                            : n === 3
                              ? "Moderate"
                              : n === 4
                                ? "Major"
                                : "Critical"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Risk Score</span>
                  <span className={`text-2xl font-bold ${getRiskColor(task?.riskProbability || 1, task?.riskImpact || 1)}`}>
                    {(task?.riskProbability || 1) * (task?.riskImpact || 1)} / 25
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium capitalize">{(task?.status || "unknown").replace("-", " ")}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Deadline</p>
              <p className="font-medium">{task?.deadline ? new Date(task.deadline).toLocaleDateString() : "N/A"}</p>
            </div>
          </div>
        </div>

        <div className={`flex items-center ${canDelete ? 'justify-between' : 'justify-end'}`}>
          {/* Delete Button (left side) - only show if user has permission */}
          {canDelete && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete Task"}
            </Button>
          )}
          
          {/* Close Button (right side) */}
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Delete</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this task? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-muted-foreground">
                Task: <span className="font-medium">{task?.title || "Untitled Task"}</span>
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
