import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeamsTab } from "@/components/settings/teams-tab"
import { RolesTab } from "@/components/settings/roles-tab"
import { DangerZoneTab } from "@/components/settings/danger-zone-tab"
import { useProject } from "@/contexts/ProjectContext"
import { useNavigate } from "react-router-dom"

export default function SettingsPage() {
  const { hasPermission, isOwner } = useProject()
  const navigate = useNavigate()
  
  // Hide Settings page if user doesn't have can_manage_settings permission
  if (!hasPermission('can_manage_settings')) {
    // Redirect to projects or show access denied
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
        <Tabs defaultValue="teams" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="teams">
              <TeamsTab />
            </TabsContent>

            <TabsContent value="roles">
              <RolesTab />
            </TabsContent>

            <TabsContent value="danger">
              <DangerZoneTab isOwner={isOwner()} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
