import { useState, useEffect } from "react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Activity, Users, Clock, Edit2, Check, X } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import { ProjectMembersModal } from "@/components/modals/project-members-modal"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"

export default function ProjectInfoPage() {
  const { currentProject, getUserRole, hasPermission, loadProject } = useProject()
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)
  const [workSchedule, setWorkSchedule] = useState({
    workingDaysPerWeek: currentProject?.workSchedule?.workingDaysPerWeek || 5,
    daysOffPerWeek: currentProject?.workSchedule?.daysOffPerWeek || 2,
    hoursPerDay: currentProject?.workSchedule?.hoursPerDay || 8,
  })
  const [isSaving, setIsSaving] = useState(false)
  
  const canManageWorkSchedule = hasPermission('can_manage_work_schedule')

  // Get member count (includes owner if owner is in members array)
  const memberCount = currentProject?.members?.length || 0

  if (!currentProject) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  // Get owner info
  const owner = currentProject?.owner || currentProject?.ownerId
  const ownerName = typeof owner === 'object' 
    ? (owner?.displayName || owner?.name || owner?.email || 'Unknown')
    : 'Unknown'
  const ownerAvatar = typeof owner === 'object' ? (owner?.photoURL || owner?.avatar || null) : null

  // Get project creation date
  const createdAt = currentProject?.createdAt ? new Date(currentProject.createdAt) : new Date()
  const formattedDate = format(createdAt, "d MMM yyyy")

  // Get project ID
  const projectId = currentProject?.id || currentProject?._id

  // Update work schedule state when project changes
  useEffect(() => {
    if (currentProject?.workSchedule) {
      setWorkSchedule({
        workingDaysPerWeek: currentProject.workSchedule.workingDaysPerWeek || 5,
        daysOffPerWeek: currentProject.workSchedule.daysOffPerWeek || 2,
        hoursPerDay: currentProject.workSchedule.hoursPerDay || 8,
      })
    }
  }, [currentProject])

  const handleSaveSchedule = async () => {
    if (!projectId || !canManageWorkSchedule) return

    // Validate: workingDaysPerWeek + daysOffPerWeek should equal 7
    if (workSchedule.workingDaysPerWeek + workSchedule.daysOffPerWeek !== 7) {
      toast.error('Working days + days off must equal 7 days per week')
      return
    }

    if (workSchedule.workingDaysPerWeek < 1 || workSchedule.workingDaysPerWeek > 7) {
      toast.error('Working days must be between 1 and 7')
      return
    }

    if (workSchedule.daysOffPerWeek < 0 || workSchedule.daysOffPerWeek > 6) {
      toast.error('Days off must be between 0 and 6')
      return
    }

    if (workSchedule.hoursPerDay < 1 || workSchedule.hoursPerDay > 24) {
      toast.error('Hours per day must be between 1 and 24')
      return
    }

    setIsSaving(true)
    try {
      await projectsAPI.update(projectId, {
        workSchedule: {
          workingDaysPerWeek: parseInt(workSchedule.workingDaysPerWeek.toString()),
          daysOffPerWeek: parseInt(workSchedule.daysOffPerWeek.toString()),
          hoursPerDay: parseFloat(workSchedule.hoursPerDay.toString()),
        },
      })
      toast.success('Work schedule updated successfully')
      setIsEditingSchedule(false)
      // Reload project to get updated data
      if (loadProject) {
        await loadProject(projectId)
      }
    } catch (error: any) {
      console.error('Failed to update work schedule:', error)
      toast.error(error.response?.data?.message || 'Failed to update work schedule')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    // Reset to original values
    if (currentProject?.workSchedule) {
      setWorkSchedule({
        workingDaysPerWeek: currentProject.workSchedule.workingDaysPerWeek || 5,
        daysOffPerWeek: currentProject.workSchedule.daysOffPerWeek || 2,
        hoursPerDay: currentProject.workSchedule.hoursPerDay || 8,
      })
    }
    setIsEditingSchedule(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <h1 className="text-3xl font-bold text-foreground">Project Information</h1>
          <p className="mt-2 text-muted-foreground">View project details and recent activity</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Project Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>Basic project details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Project Name</span>
                <span className="text-sm font-medium text-foreground">{currentProject?.name || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Project ID</span>
                <span className="text-sm font-mono text-foreground">
                  {projectId || 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Description</span>
                <span className="text-sm text-foreground text-right max-w-[60%]">
                  {currentProject?.description || 'No description provided'}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline" className="bg-success/10 text-success border-success">
                  {currentProject?.status || 'Active'}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Created At</span>
                <span className="text-sm text-foreground">{formattedDate}</span>
              </div>

              {ownerName && (
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Project Owner</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={ownerAvatar || "/placeholder.svg"} alt={ownerName} />
                      <AvatarFallback className="text-xs">
                        {ownerName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{ownerName}</span>
                  </div>
                </div>
              )}

              {/* Members Row - Interactive for Active Members */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Members</span>
                <motion.div
                  whileHover={{ scale: 1.05, x: -3 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowMembersModal(true)}
                    className="border border-transparent hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-200"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    {memberCount} {memberCount === 1 ? 'member' : 'members'}
                  </Button>
                </motion.div>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Your Role</span>
                <Badge variant="secondary">{getUserRole()}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Work Schedule Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Work Schedule
                  </CardTitle>
                  <CardDescription>Configure project working hours and days</CardDescription>
                </div>
                {canManageWorkSchedule && !isEditingSchedule && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingSchedule(true)}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditingSchedule ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="working-days">Working Days/Week</Label>
                      <Input
                        id="working-days"
                        type="number"
                        min="1"
                        max="7"
                        value={workSchedule.workingDaysPerWeek}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0
                          setWorkSchedule(prev => ({
                            ...prev,
                            workingDaysPerWeek: value,
                            daysOffPerWeek: 7 - value, // Auto-calculate days off
                          }))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="days-off">Days Off/Week</Label>
                      <Input
                        id="days-off"
                        type="number"
                        min="0"
                        max="6"
                        value={workSchedule.daysOffPerWeek}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0
                          setWorkSchedule(prev => ({
                            ...prev,
                            daysOffPerWeek: value,
                            workingDaysPerWeek: 7 - value, // Auto-calculate working days
                          }))
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hours-day">Hours/Day</Label>
                      <Input
                        id="hours-day"
                        type="number"
                        min="1"
                        max="24"
                        step="0.5"
                        value={workSchedule.hoursPerDay}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0
                          setWorkSchedule(prev => ({
                            ...prev,
                            hoursPerDay: value,
                          }))
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveSchedule}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        'Saving...'
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Save
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-muted-foreground">Schedule</span>
                    <span className="text-sm font-medium text-foreground">
                      {currentProject?.workSchedule?.workingDaysPerWeek || 5}/
                      {currentProject?.workSchedule?.daysOffPerWeek || 2} for{' '}
                      {currentProject?.workSchedule?.hoursPerDay || 8}h
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {currentProject?.workSchedule?.workingDaysPerWeek || 5} working days per week,{' '}
                    {currentProject?.workSchedule?.daysOffPerWeek || 2} days off,{' '}
                    {currentProject?.workSchedule?.hoursPerDay || 8} hours per day
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Card - Placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest project events and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Activity feed coming soon</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Project Members Modal */}
      <ProjectMembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        members={currentProject?.members || []}
      />
    </div>
  )
}

