"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Loader2, Bell, CheckCircle2 } from "lucide-react"
import { memberSettings as memberSettingsAPI } from "@/services/api"
import { useProject } from "@/contexts/ProjectContext"
import { toast } from "sonner"
import { useParams } from "react-router-dom"

export function NotificationsTab() {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>()
  const { currentProject, hasPermission } = useProject()
  const projectId = urlProjectId || currentProject?.id || currentProject?._id

  // Check if user has permissions for manager alerts
  const hasFinancialRiskPermission = hasPermission('notify_on_financial_risk')
  const hasRoleChangePermission = hasPermission('notify_on_role_change')

  const [settings, setSettings] = useState({
    notifyOnTaskAssignment: true,
    notifyOnBudgetRisk: true,
    notifyOnRoleChange: true,
    notifyOnTaskOverdue: true,
    notifyOnTaskCompleted: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(false)

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!projectId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await memberSettingsAPI.getNotificationSettings(projectId)
        if (response.data?.notificationSettings) {
          const fetchedSettings = response.data.notificationSettings
          
          // Auto-disable manager alerts if user doesn't have permissions
          setSettings({
            notifyOnTaskAssignment: fetchedSettings.notifyOnTaskAssignment ?? true,
            notifyOnBudgetRisk: hasFinancialRiskPermission 
              ? (fetchedSettings.notifyOnBudgetRisk ?? true)
              : false, // Auto-disable if no permission
            notifyOnRoleChange: hasRoleChangePermission 
              ? (fetchedSettings.notifyOnRoleChange ?? true)
              : false, // Auto-disable if no permission
            notifyOnTaskOverdue: fetchedSettings.notifyOnTaskOverdue ?? true,
            notifyOnTaskCompleted: fetchedSettings.notifyOnTaskCompleted ?? true,
          })
        } else {
          // Set defaults based on permissions
          setSettings({
            notifyOnTaskAssignment: true,
            notifyOnBudgetRisk: hasFinancialRiskPermission,
            notifyOnRoleChange: hasRoleChangePermission,
            notifyOnTaskOverdue: true,
            notifyOnTaskCompleted: true,
          })
        }
      } catch (error: any) {
        console.error("Failed to fetch notification settings:", error)
        toast.error("Failed to load notification settings")
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [projectId, hasFinancialRiskPermission, hasRoleChangePermission])

  // Save settings
  const handleSave = async (key: string, value: boolean) => {
    if (!projectId) return

    // Prevent enabling manager alerts if user doesn't have permissions
    if (key === 'notifyOnBudgetRisk' && value && !hasFinancialRiskPermission) {
      toast.error("You don't have permission to receive financial risk notifications. Contact your project manager.")
      return
    }
    
    if (key === 'notifyOnRoleChange' && value && !hasRoleChangePermission) {
      toast.error("You don't have permission to receive role change notifications. Contact your project manager.")
      return
    }

    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    setSaving(true)
    setLastSaved(false)

    try {
      await memberSettingsAPI.updateNotificationSettings(projectId, newSettings)
      setLastSaved(true)
      setTimeout(() => setLastSaved(false), 2000)
    } catch (error: any) {
      console.error("Failed to save notification settings:", error)
      toast.error("Failed to save notification settings")
      // Revert on error
      setSettings(settings)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Manage your notification preferences for this project</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>Manage what notifications you receive for this project</CardDescription>
          </div>
          {lastSaved && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Saved
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* General Notifications */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">General Notifications</h3>
            <p className="text-xs text-muted-foreground">Task-related notifications</p>
          </div>
          
          <div className="space-y-4 pl-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="task-assignment" className="text-sm font-normal">
                  Task Assignments
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when you're assigned to a task
                </p>
              </div>
              <div className="flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id="task-assignment"
                  checked={settings.notifyOnTaskAssignment}
                  onCheckedChange={(checked) => handleSave('notifyOnTaskAssignment', checked)}
                  disabled={saving}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="task-overdue" className="text-sm font-normal">
                  Task Overdue
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when a task is past its deadline
                </p>
              </div>
              <div className="flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id="task-overdue"
                  checked={settings.notifyOnTaskOverdue}
                  onCheckedChange={(checked) => handleSave('notifyOnTaskOverdue', checked)}
                  disabled={saving}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="task-completed" className="text-sm font-normal">
                  Task Completed
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get notified when a task you're assigned to is marked as done
                </p>
              </div>
              <div className="flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id="task-completed"
                  checked={settings.notifyOnTaskCompleted}
                  onCheckedChange={(checked) => handleSave('notifyOnTaskCompleted', checked)}
                  disabled={saving}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Manager Alerts */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-1">Manager Alerts</h3>
            <p className="text-xs text-muted-foreground">Financial and role-related notifications</p>
          </div>
          
          <div className="space-y-4 pl-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="budget-risk" className="text-sm font-normal">
                  Budget & Financial Risk
                </Label>
                <p className="text-xs text-muted-foreground">
                  {hasFinancialRiskPermission 
                    ? "Get notified about budget overruns and financial risks"
                    : "Requires 'Financial Risk Notifications' permission from your role"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id="budget-risk"
                  checked={settings.notifyOnBudgetRisk}
                  onCheckedChange={(checked) => handleSave('notifyOnBudgetRisk', checked)}
                  disabled={saving || !hasFinancialRiskPermission}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="role-change" className="text-sm font-normal">
                  Role & Permission Changes
                </Label>
                <p className="text-xs text-muted-foreground">
                  {hasRoleChangePermission 
                    ? "Get notified when your role or permissions are updated"
                    : "Requires 'Role Change Notifications' permission from your role"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                <Switch
                  id="role-change"
                  checked={settings.notifyOnRoleChange}
                  onCheckedChange={(checked) => handleSave('notifyOnRoleChange', checked)}
                  disabled={saving || !hasRoleChangePermission}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

