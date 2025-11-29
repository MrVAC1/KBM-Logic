import { useState } from "react"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Activity, Users } from "lucide-react"
import { useProject } from "@/contexts/ProjectContext"
import { ProjectMembersModal } from "@/components/modals/project-members-modal"

export default function ProjectInfoPage() {
  const { currentProject, getUserRole } = useProject()
  const [showMembersModal, setShowMembersModal] = useState(false)

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

