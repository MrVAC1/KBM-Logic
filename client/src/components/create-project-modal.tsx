"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Lock, Copy } from "lucide-react"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"

interface CreateProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (newProject: any) => void
}

export function CreateProjectModal({ open, onOpenChange, onSuccess }: CreateProjectModalProps) {
  const { user } = useAuth()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [password, setPassword] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [sourceProjectId, setSourceProjectId] = useState<string>("")
  const [availableProjects, setAvailableProjects] = useState<any[]>([])

  // Load user's owned projects for role import
  useEffect(() => {
    if (open) {
      loadOwnedProjects()
    }
  }, [open])

  const loadOwnedProjects = async () => {
    try {
      const response = await projectsAPI.getAll()
      // Filter projects where user is owner
      const projectsData = Array.isArray(response.data) ? response.data : []
      const owned = projectsData.filter((p: any) => 
        p.ownerId?.toString() === user?.uid || p.owner?.id === user?.uid
      )
      setAvailableProjects(owned)
    } catch (error) {
      // Silently fail - role import is optional
    }
  }

  const handleCreate = async () => {
    if (!name || !description || !password) {
      return
    }

    setIsCreating(true)

    try {
      let rolesToUse = null

      // If source project selected, fetch its roles
      if (sourceProjectId) {
        try {
          const sourceResponse = await projectsAPI.getById(sourceProjectId)
          if (sourceResponse.data?.roles) {
            rolesToUse = sourceResponse.data.roles
          }
        } catch (err) {
          toast.error('Failed to load roles from source project')
        }
      }

      // Create project
      const response = await projectsAPI.create({
        name,
        description,
        password,
        ...(rolesToUse && { importRolesFrom: sourceProjectId }),
      })

      // Backend returns: { success: true, data: {...} }
      // Axios unwraps to: response.data = { success: true, data: {...} }
      // Extract the actual project data
      const newProject = response.data?.data || response.data
      
      console.log('✅ Project created, response:', response.data)
      console.log('✅ Extracted project:', newProject)

      toast.success('Project created successfully!')
      
      // Reset form
      setName("")
      setDescription("")
      setPassword("")
      setSourceProjectId("")
      
      // Close modal first
      onOpenChange(false)
      
      // Call onSuccess callback to update projects list IMMEDIATELY
      if (onSuccess && newProject) {
        // Ensure the project has proper structure
        const projectWithId = {
          ...newProject,
          id: newProject._id || newProject.id,
          _id: newProject._id || newProject.id,
        }
        onSuccess(projectWithId)
      }
      
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create project')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>Set up a new project to start collaborating with your team</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name *</Label>
            <Input
              id="project-name"
              placeholder="e.g., Mobile App Redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">Description *</Label>
            <Textarea
              id="project-description"
              placeholder="Describe your project goals and scope"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-password">Access Password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="project-password"
                type="password"
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">Team members will need this password to join the project</p>
          </div>

          {/* Role Import */}
          {availableProjects.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="import-roles">Copy Settings From (Optional)</Label>
              <Select value={sourceProjectId} onValueChange={setSourceProjectId}>
                <SelectTrigger id="import-roles">
                  <SelectValue placeholder="Select a project to copy roles from" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None - Use default roles</SelectItem>
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id || project._id} value={project.id || project._id}>
                      <div className="flex items-center gap-2">
                        <Copy className="h-3 w-3" />
                        {project.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Import custom roles and permissions from an existing project you own
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> Budget can be configured after project creation
              in the Financial Dashboard
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name || !description || !password || isCreating}>
            {isCreating ? "Creating..." : "Create Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
