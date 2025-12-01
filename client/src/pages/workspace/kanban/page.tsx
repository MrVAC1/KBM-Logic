import { useState, useEffect, useCallback } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Plus, AlertTriangle, CheckCircle2, XCircle, MessageSquare } from "lucide-react"
import { CreateTaskModal } from "@/components/create-task-modal"
import { TaskDetailModal } from "@/components/task-detail-modal"
import { tasks as tasksAPI } from "@/services/api"
import { useProject } from "@/contexts/ProjectContext"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { extractArrayFromResponse, safeArray, safeFilter } from "@/lib/safeUtils"
import { cn } from "@/lib/utils"

const columns = [
  { id: "Todo", title: "To Do", color: "border-slate-500", status: "Todo" },
  { id: "In Progress", title: "In Progress", color: "border-blue-500", status: "In Progress" },
  { id: "Review", title: "Review", color: "border-yellow-500", status: "Review" },
  { id: "Done", title: "Done", color: "border-green-500", status: "Done" },
]

export default function KanbanPage() {
  const { currentProject, hasPermission, getUserRole, loading: projectLoading } = useProject()
  const { user } = useAuth()
  
  // Get projectId from currentProject (workspace context) or URL params as fallback
  const [searchParams] = useSearchParams()
  const projectIdFromUrl = searchParams.get('project')
  const projectId = currentProject?.id || currentProject?._id || projectIdFromUrl
  
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false)
  const [showRequestChangesModal, setShowRequestChangesModal] = useState(false)
  const [requestChangesTask, setRequestChangesTask] = useState<any | null>(null)
  const [requestChangesComment, setRequestChangesComment] = useState("")

  // Load tasks from API
  const loadTasks = useCallback(async () => {
    if (!projectId) {
      console.log('⚠️ No projectId available, skipping task load')
      setTasks([])
      return
    }
    
    console.log('📋 Loading tasks for project:', projectId)
    
    setLoading(true)
    try {
      const response = await tasksAPI.getByProject(projectId)
      
      // Debug: Log response structure
      console.log('🔍 Tasks API Response:', {
        hasData: !!response.data,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        hasNestedData: !!response.data?.data,
        nestedDataType: typeof response.data?.data,
        nestedIsArray: Array.isArray(response.data?.data),
      })
      
      // Axios response structure: response.data = { success: true, data: tasks }
      // Extract the nested data array
      let tasksData = null
      
      // Try multiple extraction methods
      if (Array.isArray(response.data)) {
        // Direct array
        tasksData = response.data
      } else if (Array.isArray(response.data?.data)) {
        // Nested: { success: true, data: [...] }
        tasksData = response.data.data
      } else {
        // Use utility function as fallback
        tasksData = extractArrayFromResponse<any>(response.data || response)
      }
      
      // Ensure we have an array
      const validTasks = safeArray(tasksData)
      
      console.log('✅ Extracted tasks:', validTasks.length, 'items')
      if (validTasks.length > 0) {
        console.log('📋 Sample task:', {
          id: validTasks[0]._id || validTasks[0].id,
          title: validTasks[0].title,
          status: validTasks[0].status,
          assignees: validTasks[0].assignees,
        })
        // Log status distribution
        const statusCounts = validTasks.reduce((acc: any, task: any) => {
          const status = task.status || 'Unknown'
          acc[status] = (acc[status] || 0) + 1
          return acc
        }, {})
        console.log('📊 Task status distribution:', statusCounts)
      }
      
      // Normalize task properties (ensure id and status exist)
      const normalizedTasks = validTasks.map((task: any) => {
        // Ensure status matches one of the valid column statuses
        const validStatuses = ['Todo', 'In Progress', 'Review', 'Done']
        const currentStatus = task.status || 'Todo'
        const normalizedStatus = validStatuses.includes(currentStatus) ? currentStatus : 'Todo'
        
        return {
          ...task,
          id: task.id || task._id,
          _id: task._id || task.id,
          status: normalizedStatus,
        }
      })
      
      setTasks(normalizedTasks)
    } catch (error: any) {
      console.error('❌ Failed to load tasks:', error)
      console.error('❌ Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      })
      toast.error(error.response?.data?.message || 'Failed to load tasks')
      // CRITICAL: Always set empty array on error
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    // Wait for currentProject to be loaded before fetching tasks
    if (currentProject && projectId) {
      loadTasks()
    } else if (!currentProject) {
      // Project not loaded yet, clear tasks
      setTasks([])
    }
  }, [loadTasks, currentProject, projectId])

  // Filter tasks with defensive checks
  const getTasksByStatus = (status: string) => {
    // CRITICAL: Use safe utilities to prevent crashes
    const safeTasks = safeArray(tasks)
    let filtered = safeFilter(safeTasks, (task) => task?.status === status)
    
    // Apply "My Tasks" filter
    if (showMyTasksOnly && user?.uid) {
      filtered = safeFilter(filtered, (task) => {
        const assignees = safeArray(task?.assignees)
        return assignees.some((assignee: any) => {
          const assigneeId = assignee?.userId || assignee?.id || assignee
          return assigneeId?.toString() === user.uid?.toString()
        })
      })
    }
    
    return filtered
  }

  // State Machine Actions
  const handleClaimTask = async (task: any) => {
    if (!projectId || !user?.uid) return
    
    try {
      await tasksAPI.update(task._id || task.id, {
        status: 'In Progress',
        assignees: [user.uid],
      })
      toast.success('Task claimed and moved to In Progress')
      loadTasks()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to claim task')
    }
  }

  const handleFinishTask = async (task: any) => {
    if (!projectId) return
    
    try {
      await tasksAPI.update(task._id || task.id, {
        status: 'Review',
      })
      toast.success('Task moved to Review')
      loadTasks()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to finish task')
    }
  }

  const handleApproveTask = async (task: any) => {
    if (!projectId) return
    
    // Check if user has Reviewer role or can manage tasks
    const userRole = getUserRole()
    const isReviewer = userRole === 'Reviewer' || userRole === 'Admin' || userRole === 'PM'
    
    if (!isReviewer && !hasPermission('can_edit_tasks')) {
      toast.error('Only reviewers can approve tasks')
      return
    }
    
    try {
      await tasksAPI.update(task._id || task.id, {
        status: 'Done',
      })
      toast.success('Task approved and moved to Done')
      loadTasks()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve task')
    }
  }

  const handleRequestChanges = async () => {
    if (!requestChangesTask || !projectId) return
    
    try {
      await tasksAPI.update(requestChangesTask._id || requestChangesTask.id, {
        status: 'In Progress',
        // Add comment to description or create a comment field
        description: `${requestChangesTask.description || ''}\n\n[Requested Changes: ${requestChangesComment}]`,
      })
      toast.success('Changes requested, task moved back to In Progress')
      setShowRequestChangesModal(false)
      setRequestChangesTask(null)
      setRequestChangesComment("")
      loadTasks()
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to request changes')
    }
  }

  // Check if user is assigned to task
  const isAssignedToMe = (task: any) => {
    if (!user?.uid) return false
    const assignees = Array.isArray(task?.assignees) ? task.assignees : []
    return assignees.some((assignee: any) => {
      const assigneeId = assignee?.userId || assignee?.id || assignee
      return assigneeId?.toString() === user.uid?.toString()
    })
  }

  // Check if user can move task to Done (not Developers)
  const canMoveToDone = (task: any) => {
    const userRole = getUserRole()
    // Developers cannot directly move to Done
    if (userRole === 'Developer') {
      return false
    }
    return hasPermission('can_edit_tasks') || userRole === 'Admin' || userRole === 'PM' || userRole === 'Reviewer'
  }

  const getRiskBadge = (probability: number, impact: number) => {
    const riskScore = probability * impact
    if (riskScore >= 15) return { label: "Critical", color: "bg-destructive text-destructive-foreground" }
    if (riskScore >= 10) return { label: "High", color: "bg-warning text-warning-foreground" }
    if (riskScore >= 5) return { label: "Medium", color: "bg-info text-info-foreground" }
    return { label: "Low", color: "bg-success text-success-foreground" }
  }

  const getTotalHours = (task: any) => {
    if (!task.timeLogs || !Array.isArray(task.timeLogs)) return 0
    return task.timeLogs.reduce((sum: number, log: any) => {
      const duration = log.duration || 0 // Duration in seconds
      return sum + (duration / 3600) // Convert to hours
    }, 0)
  }

  // Show loading state while project is loading or tasks are being fetched
  if (projectLoading || (loading && tasks.length === 0 && !projectId)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">
            {projectLoading ? 'Loading project...' : 'Loading tasks...'}
          </p>
        </div>
      </div>
    )
  }
  
  // Show message if no project is available
  if (!currentProject && !projectId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No project selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Kanban Board</h1>
              <p className="mt-2 text-muted-foreground">Manage tasks with smart assignment logic</p>
            </div>
            <div className="flex items-center gap-4">
              {/* My Tasks Filter */}
              <div className="flex items-center gap-2">
                <Switch
                  id="my-tasks-filter"
                  checked={showMyTasksOnly}
                  onCheckedChange={setShowMyTasksOnly}
                />
                <Label htmlFor="my-tasks-filter" className="cursor-pointer">
                  My Tasks
                </Label>
              </div>
              
              {hasPermission('can_create_tasks') && (
                <Button onClick={() => setShowCreateTask(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnTasks = getTasksByStatus(column.status)
            const isReviewColumn = column.status === 'Review'
            const isDoneColumn = column.status === 'Done'
            
            return (
              <div 
                key={column.id} 
                className="flex flex-col min-w-[350px] max-w-[350px] flex-shrink-0"
              >
                {/* Column Header */}
                <div className={`border-t-4 rounded-t-lg bg-card p-3 mb-2 ${column.color}`}>
                  <h3 className="font-semibold flex items-center justify-between">
                    {column.title}
                    <Badge variant="secondary">{columnTasks.length}</Badge>
                  </h3>
                </div>

                {/* Tasks List */}
                <div className="flex-1 space-y-2 overflow-y-auto pr-2 max-h-[calc(100vh-300px)]">
                  {columnTasks.map((task) => {
                    const risk = task.risk || {}
                    const riskScore = (risk.probability || 1) * (risk.impact || 1)
                    const assignedToMe = isAssignedToMe(task)
                    const totalHours = getTotalHours(task)
                    
                    return (
                      <Card
                        key={task._id || task.id}
                        className={cn(
                          "cursor-pointer hover:border-primary/50 transition-all",
                          "h-[240px] flex flex-col overflow-hidden",
                          "bg-card border-border p-0 gap-0"
                        )}
                        onClick={() => setSelectedTask(task)}
                      >
                        {/* Header: Title */}
                        <CardHeader className="px-0 pt-[18px] pb-1 flex-shrink-0">
                          <CardTitle className="text-sm font-bold line-clamp-2 px-3">{task.title}</CardTitle>
                        </CardHeader>
                        
                        {/* Body: Description */}
                        <CardContent className="px-0 pt-1 pb-0 flex-1 flex flex-col justify-between min-w-0 overflow-hidden">
                          {task.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 break-words mb-auto px-3">
                              {task.description}
                            </p>
                          )}
                          
                          {/* Action Buttons - Above the footer line */}
                          <div 
                            className="mt-auto px-0 flex gap-1.5 flex-shrink-0" 
                            onClick={(e) => e.stopPropagation()}
                          >
                            {column.status === 'Todo' && !assignedToMe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  "flex-1 text-xs h-7 mx-3",
                                  "bg-transparent hover:bg-transparent active:bg-transparent",
                                  "border border-transparent",
                                  "hover:border-primary active:border-primary focus-visible:border-primary",
                                  "text-foreground hover:text-foreground active:text-foreground",
                                  "transition-all duration-200",
                                  "shadow-none hover:shadow-none"
                                )}
                                onClick={() => handleClaimTask(task)}
                              >
                                Claim
                              </Button>
                            )}
                            
                            {column.status === 'In Progress' && assignedToMe && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className={cn(
                                  "flex-1 text-xs h-7 mx-3",
                                  "bg-transparent hover:bg-transparent active:bg-transparent",
                                  "border border-transparent",
                                  "hover:border-primary active:border-primary focus-visible:border-primary",
                                  "text-foreground hover:text-foreground active:text-foreground",
                                  "transition-all duration-200",
                                  "shadow-none hover:shadow-none"
                                )}
                                onClick={() => handleFinishTask(task)}
                              >
                                Finish
                              </Button>
                            )}
                            
                            {isReviewColumn && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={cn(
                                    "flex-1 text-xs h-7 mx-3",
                                    "bg-transparent hover:bg-transparent active:bg-transparent",
                                    "border border-transparent",
                                    "hover:border-primary active:border-primary focus-visible:border-primary",
                                    "text-foreground hover:text-foreground active:text-foreground",
                                    "transition-all duration-200",
                                    "shadow-none hover:shadow-none",
                                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-transparent"
                                  )}
                                  onClick={() => handleApproveTask(task)}
                                  disabled={!canMoveToDone(task)}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1 flex-shrink-0" />
                                  <span className="truncate">Approve</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className={cn(
                                    "flex-1 text-xs h-7 mx-3",
                                    "bg-transparent hover:bg-transparent active:bg-transparent",
                                    "border border-transparent",
                                    "hover:border-primary active:border-primary focus-visible:border-primary",
                                    "text-foreground hover:text-foreground active:text-foreground",
                                    "transition-all duration-200",
                                    "shadow-none hover:shadow-none"
                                  )}
                                  onClick={() => {
                                    setRequestChangesTask(task)
                                    setShowRequestChangesModal(true)
                                  }}
                                >
                                  <MessageSquare className="h-3 w-3 mr-1 flex-shrink-0" />
                                  <span className="truncate">Changes</span>
                                </Button>
                              </>
                            )}
                          </div>
                          
                          {/* Footer: Metadata Row - Avatar, Priority, Deadline */}
                          <div className="mt-2 px-3 flex items-center justify-between gap-2 min-w-0 pt-2 pb-2 border-t border-border">
                            {/* Left: Avatar & Name */}
                            <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
                              {(() => {
                                // Handle Department assignment
                                if (task.department) {
                                  return (
                                    <>
                                      <div className="h-6 w-6 rounded-full border border-border/50 flex-shrink-0 flex items-center justify-center">
                                        <Users className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                        {task.department}
                                      </span>
                                    </>
                                  )
                                }
                                
                                // Handle User assignment
                                if (Array.isArray(task.assignees) && task.assignees.length > 0) {
                                  const firstAssignee = task.assignees[0]
                                  const assigneeId = firstAssignee?.userId || firstAssignee?.id || firstAssignee
                                  const assigneeUser = Array.isArray(currentProject?.members) 
                                    ? currentProject.members.find((m: any) => 
                                        (m.userId?._id || m.userId?.id || m.userId)?.toString() === assigneeId?.toString()
                                      )
                                    : null
                                  
                                  const displayName = assigneeUser?.userId?.displayName || 
                                                     assigneeUser?.userId?.nickname || 
                                                     assigneeUser?.displayName ||
                                                     'Unknown'
                                  
                                  return (
                                    <>
                                      <Avatar className="h-6 w-6 border border-border flex-shrink-0">
                                        <AvatarImage
                                          src={assigneeUser?.userId?.photoURL || assigneeUser?.userId?.avatar || "/placeholder.svg"}
                                          alt={displayName}
                                        />
                                        <AvatarFallback className="text-[10px] font-medium border border-border">
                                          {displayName.slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                                        {task.assignees.length > 1 
                                          ? `${displayName} +${task.assignees.length - 1}`
                                          : displayName
                                        }
                                      </span>
                                    </>
                                  )
                                }
                                
                                // Unassigned
                                return (
                                  <>
                                    <div className="h-6 w-6 rounded-full border border-border/50 flex-shrink-0" />
                                    <span className="text-xs text-muted-foreground">Unassigned</span>
                                  </>
                                )
                              })()}
                            </div>
                            
                            {/* Center: Priority/Risk Badge */}
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {riskScore > 1 && (
                                <div className={cn(
                                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
                                  getRiskBadge(risk.probability || 1, risk.impact || 1).color
                                )}>
                                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                  <span className="whitespace-nowrap">{riskScore}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Right: Deadline */}
                            <div className="flex-shrink-0">
                              {task.deadline && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(task.deadline).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {columnTasks.length === 0 && (
                    <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-border p-8 h-[240px]">
                      <p className="text-sm text-muted-foreground">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modals */}
      <CreateTaskModal 
        open={showCreateTask} 
        onOpenChange={setShowCreateTask}
        onSuccess={loadTasks}
        projectId={projectId}
      />
      
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
          onUpdate={loadTasks}
        />
      )}

      {/* Request Changes Modal */}
      <Dialog open={showRequestChangesModal} onOpenChange={setShowRequestChangesModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Changes</DialogTitle>
            <DialogDescription>
              Provide feedback on why this task needs changes
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="changes-comment">Comment</Label>
              <Textarea
                id="changes-comment"
                placeholder="Explain what needs to be changed..."
                value={requestChangesComment}
                onChange={(e) => setRequestChangesComment(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => {
                setShowRequestChangesModal(false)
                setRequestChangesComment("")
              }}>
                Cancel
              </Button>
              <Button onClick={handleRequestChanges} disabled={!requestChangesComment.trim()}>
                Request Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
