"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Lock, Trash2, RotateCcw } from "lucide-react"
import { projects as projectsAPI } from "@/services/api"
import { useProject } from "@/contexts/ProjectContext"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DangerZoneTabProps {
  isOwner: boolean
}

export function DangerZoneTab({ isOwner }: DangerZoneTabProps) {
  const navigate = useNavigate()
  const { currentProject, hasPermission } = useProject()
  const projectId = currentProject?.id || currentProject?._id
  const canEditBudget = hasPermission('can_edit_budget')
  
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRecalculating, setIsRecalculating] = useState(false)

  const handleChangePassword = () => {
    console.log("Changing password...")
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleRecalculateFinancials = async () => {
    if (!projectId) {
      toast.error('Project ID not found')
      return
    }

    setIsRecalculating(true)

    try {
      await projectsAPI.recalculateFinancials(projectId)
      
      toast.success('Financial data recalculated successfully. Refreshing page...')
      
      // Reload the page after a short delay to show updated data
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error: any) {
      console.error('Failed to recalculate financials:', error)
      toast.error(error.response?.data?.message || 'Failed to recalculate financials')
      setIsRecalculating(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!projectId) {
      toast.error('Project ID not found')
      return
    }

    if (deleteConfirmation !== "DELETE") {
      toast.error('Please type DELETE to confirm')
      return
    }

    setIsDeleting(true)

    try {
      await projectsAPI.delete(projectId)
      
      toast.success('Project deleted successfully')
      
      // Redirect to projects page
      navigate('/projects')
    } catch (error: any) {
      console.error('Failed to delete project:', error)
      toast.error(error.response?.data?.message || 'Failed to delete project')
      setIsDeleting(false)
      setShowDeleteDialog(false)
      setDeleteConfirmation("")
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-warning">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <CardTitle className="text-warning">Danger Zone</CardTitle>
          </div>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Change Password - Owner Only */}
          {isOwner ? (
            <div className="space-y-4 pb-6 border-b border-border">
              <div className="flex items-start gap-3">
                <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Change Project Password</h4>
                  <p className="text-sm text-muted-foreground mb-4">Update the password required to join this project</p>

                <div className="space-y-3 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={!currentPassword || !newPassword || newPassword !== confirmPassword}
                  >
                    Change Password
                  </Button>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/50 p-4 mb-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <p className="text-sm">Only the project owner can change the password</p>
              </div>
            </div>
          )}

          {/* Recalculate Financial Data */}
          {(isOwner || canEditBudget) ? (
            <div className="space-y-4 pb-6 border-b border-border">
              <div className="flex items-start gap-3">
                <RotateCcw className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1">Recalculate Financial Data</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Wipe all existing financial snapshots and regenerate from project creation date. 
                    Use this if tasks are completed but EV shows $0, or if financial data appears stale. 
                    This may take 5-10 seconds for large projects.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleRecalculateFinancials}
                    disabled={isRecalculating}
                  >
                    {isRecalculating ? (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                        Recalculating...
                      </>
                    ) : (
                      <>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Recalculate Financial Data
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/50 p-4 mb-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <p className="text-sm">Only the project owner or users with budget edit permissions can recalculate financials</p>
              </div>
            </div>
          )}

          {/* Delete Project (Owner Only) */}
          {isOwner ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium mb-1 text-destructive">Delete Project</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete this project and all associated data. This action cannot be undone.
                  </p>
                  <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Project
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="h-4 w-4" />
                <p className="text-sm">Only the project owner can delete the project</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Project
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>This will permanently delete the project, including:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All tasks and their history</li>
                <li>Financial data and transactions</li>
                <li>Team members and roles</li>
                <li>Risk assessments and documentation</li>
              </ul>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm:
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="DELETE"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProject}
              disabled={deleteConfirmation !== "DELETE" || isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Forever'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
