import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeamsTab } from "@/components/settings/teams-tab"
import { RolesTab } from "@/components/settings/roles-tab"
import { DangerZoneTab } from "@/components/settings/danger-zone-tab"
import { NotificationsTab } from "@/components/settings/notifications-tab"
import { useProject } from "@/contexts/ProjectContext"
import { useNavigate } from "react-router-dom"

export default function SettingsPage() {
  const { hasPermission, isOwner, currentProject } = useProject()
  const navigate = useNavigate()
  
  // Allow access if user is a member of the project (for preferences)
  // or has can_manage_settings (for admin tabs)
  const canManageSettings = hasPermission('can_manage_settings')
  
  // If no project or user is not a member and can't manage settings, redirect
  if (!currentProject) {
    navigate('/projects')
    return null
  }
  
  // If user can manage settings, they have access
  // Otherwise, check if they're a member (they can at least view preferences)
  const hasAccess = canManageSettings || currentProject?.members?.length > 0
  
  if (!hasAccess) {
    navigate('/projects')
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Project Settings</h1>
            <p className="mt-2 text-muted-foreground">Manage teams, roles, invitations, and project configuration</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <Tabs defaultValue="preferences" className="w-full">
          <TabsList className={`grid w-full ${canManageSettings ? 'grid-cols-4' : 'grid-cols-1'}`}>
            <TabsTrigger value="preferences">My Preferences</TabsTrigger>
            {canManageSettings && (
              <>
                <TabsTrigger value="teams">Teams</TabsTrigger>
                <TabsTrigger value="roles">Roles</TabsTrigger>
                <TabsTrigger value="danger">Danger Zone</TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="preferences">
              <NotificationsTab />
            </TabsContent>

            {canManageSettings && (
              <>
                <TabsContent value="teams">
                  <TeamsTab />
                </TabsContent>

                <TabsContent value="roles">
                  <RolesTab />
                </TabsContent>

                <TabsContent value="danger">
                  <DangerZoneTab isOwner={isOwner()} />
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  )
}
