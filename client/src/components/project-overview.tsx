import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Clock, ShieldAlert, Users } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"

interface ProjectOverviewProps {
  project: any
}

export function ProjectOverview({ project }: ProjectOverviewProps) {
  const { getUserRole } = useProject()

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
            <p className="mt-2 text-muted-foreground">{project.description || 'No description provided'}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Status Card */}
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                  <ShieldAlert className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">Waiting for Access Approval</CardTitle>
                  <CardDescription>You have successfully joined this project</CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {getUserRole()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You have successfully joined <span className="font-medium text-foreground">{project.name}</span>. 
                Please wait for the Project Manager to assign you a role to view tasks and data.
              </p>
            </CardContent>
          </Card>

          {/* Project Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>Basic project details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="outline" className="bg-success/10 text-success border-success">
                  {project.status || 'Active'}
                </Badge>
              </div>

              {project.owner && (
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Project Owner</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={project.owner.avatar || "/placeholder.svg"} alt={project.owner.name} />
                      <AvatarFallback className="text-xs">
                        {project.owner.name?.slice(0, 2).toUpperCase() || "PO"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{project.owner.name}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Your Role</span>
                <Badge variant="secondary">{getUserRole()}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* What's Next Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                What's Next?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                    1
                  </div>
                  <div>
                    <p className="text-sm font-medium">Contact the Project Manager</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Reach out to {project.owner?.name || 'the project owner'} to request access permissions
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                    2
                  </div>
                  <div>
                    <p className="text-sm font-medium">Wait for Role Assignment</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Once assigned a role, you'll be able to view tasks, budgets, and other project data
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
                    3
                  </div>
                  <div>
                    <p className="text-sm font-medium">Refresh This Page</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      After your role is updated, refresh to see the full project workspace
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

