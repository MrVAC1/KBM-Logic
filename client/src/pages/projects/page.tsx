import { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, Calendar } from "lucide-react"
import { mockProjects, mockUsers, mockCurrentUser } from "@/lib/mock-data"
import { useAuth } from "@/contexts/AuthContext"
import { useProject } from "@/contexts/ProjectContext"
import { CreateProjectModal } from "@/components/create-project-modal"
import { JoinProjectModal } from "@/components/join-project-modal"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { projects as projectsAPI } from "@/services/api"
import { extractArrayFromResponse, safeArray, safeFilter } from "@/lib/safeUtils"

export default function ProjectsPage() {
  const navigate = useNavigate()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [projects, setProjects] = useState<any[]>([]) // Initialize with empty array, not null
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const { loadProject, clearProject } = useProject()

  // Load projects on mount and when user changes
  useEffect(() => {
    if (user?.uid) {
      // Only load projects if user is authenticated
      loadProjects()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]) // Reload when user changes

  // Clear project context when on projects page
  useEffect(() => {
    clearProject()
  }, [clearProject])

  const loadProjects = async () => {
    setLoading(true)
    try {
      const response = await projectsAPI.getAll()
      
      // Use safe utility to extract array from response
      // Handles all response structures: { data: [...] }, { success: true, data: [...] }, or direct array
      const projectsArray = extractArrayFromResponse<any>(response)
      
      console.log('📊 Extracted projects:', projectsArray.length, 'items')
      
      // Map _id to id for frontend compatibility
      const mappedProjects = projectsArray.map((project: any) => {
        // Ensure id field exists (use _id if id doesn't exist)
        const projectId = project._id || project.id
        
        // Handle ownerId - preserve populated object if it exists
        let ownerId = project.ownerId
        if (project.ownerId && typeof project.ownerId === 'object') {
          // Keep the populated object (has _id, uid, displayName, email)
          ownerId = project.ownerId
        } else {
          // Fallback to simple value
          ownerId = project.ownerId || project.owner
        }
        
        return {
          ...project,
          id: projectId, // Always set id field
          _id: projectId, // Keep _id for compatibility
          // Preserve ownerId as populated object if available
          ownerId: ownerId,
          // Preserve isOwner flag from backend
          isOwner: project.isOwner || false,
          // Ensure members array exists using safe utility
          members: safeArray(project.members),
        }
      })
      
      // CRITICAL: Always ensure we set an array (safeArray guarantees this)
      setProjects(safeArray(mappedProjects))
      console.log('✅ Projects state updated:', mappedProjects.length, 'items')
    } catch (error: any) {
      // Fallback to empty array on error
      console.error('❌ Failed to load projects:', error)
      console.error('❌ Error details:', error.response?.data || error.message)
      // CRITICAL: Always set empty array on error
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  // Handle project creation success
  const handleProjectCreated = useCallback((newProject: any) => {
    if (!newProject) {
      console.warn('⚠️ handleProjectCreated called with null/undefined project')
      return // Safety check
    }
    
    console.log('✅ Project created, adding to list:', newProject)
    
    // Map _id to id for consistency
    const mappedProject = {
      ...newProject,
      id: newProject._id || newProject.id, // Ensure id field exists
      _id: newProject._id || newProject.id, // Keep _id
      ownerId: newProject.ownerId?._id || newProject.ownerId || newProject.owner,
      members: Array.isArray(newProject.members) ? newProject.members : [],
    }
    
    // Add the new project to the list immediately (optimistic update)
    setProjects(prev => {
      // Use safe utility to ensure prev is always an array
      const safePrev = safeArray(prev)
      
      // Check if project already exists (avoid duplicates)
      const projectId = mappedProject.id || mappedProject._id
      if (!projectId) {
        console.warn('⚠️ New project has no ID, skipping add')
        return safePrev // Skip if no ID
      }
      
      const exists = safePrev.some(p => {
        const pId = p?.id || p?._id
        return pId && pId.toString() === projectId.toString()
      })
      
      if (exists) {
        console.log('ℹ️ Project already exists in list, skipping duplicate')
        return safePrev
      }
      
      // Add new project to the list
      const updated = [...safePrev, mappedProject]
      console.log('✅ Project added to list. Total projects:', updated.length)
      return updated
    })
    
    // Also reload projects to ensure we have the latest data from server
    // This ensures we get the full project data with all relationships
    setTimeout(() => {
      loadProjects()
    }, 500) // Small delay to allow backend to finish processing
  }, [loadProjects])

  // Handle entering a project workspace
  const handleEnterProject = useCallback((projectId: string) => {
    // Store active project ID
    localStorage.setItem('activeProjectId', projectId)
    // Navigate to workspace with project ID in URL
    navigate(`/workspace/kanban?project=${projectId}`)
  }, [navigate])

  const getProjectOwner = (project: any) => {
    const ownerId = project.ownerId || project.owner
    if (project.ownerId && typeof project.ownerId === 'object') {
      // Populated owner object
      return {
        nickname: project.ownerId.displayName || project.ownerId.email || 'Unknown',
        avatar: project.ownerId.photoURL || null,
      }
    }
    // Fallback to mock data
    return mockUsers.find((user) => user.id === ownerId)
  }

  const getBudgetProgress = (project: any) => {
    const spent = project.actualSpent || project.spent || 0
    const total = project.totalBudget || project.budget || 1
    return (spent / total) * 100
  }

  const isProjectOwner = (project: any) => {
    // Use isOwner flag from backend if available
    if (project.isOwner !== undefined) {
      return project.isOwner === true
    }
    
    // Fallback: Check by comparing Firebase UIDs
    const ownerId = project.ownerId || project.owner
    const currentUserUid = user?.uid
    
    if (typeof ownerId === 'object' && ownerId?.uid) {
      // Populated owner object with uid field
      return ownerId.uid === currentUserUid
    }
    
    if (typeof ownerId === 'string' && currentUserUid) {
      return ownerId === currentUserUid
    }
    
    return false
  }

  // CRITICAL: Show loading state first
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading projects...</p>
        </div>
      </div>
    )
  }

  // CRITICAL: Use safe utilities to ensure projects is always an array
  // This prevents .map(), .filter(), .length crashes
  const safeProjects = safeArray(projects)
  
  // Backend already filters projects to only return projects where user is owner or member
  // So we can use all projects returned from the API
  // Just filter out any null/undefined entries for safety using safe utility
  const userProjects = safeFilter(safeProjects, (project) => {
    return project !== null && project !== undefined // Skip null/undefined projects
  })
  
  console.log('📊 Total projects from API:', safeProjects.length)
  console.log('📊 Filtered user projects:', userProjects.length)

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Project Portfolio</h1>
              <p className="mt-2 text-muted-foreground">Manage and track all your projects in one place</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowJoinModal(true)}>
                Join Project
              </Button>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {userProjects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-medium">No projects yet</h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Get started by creating a new project or joining an existing one
              </p>
              <Button onClick={() => setShowCreateModal(true)}>Create Your First Project</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {userProjects.map((project) => {
              const projectId = project.id || project._id
              const owner = getProjectOwner(project)
              const budgetProgress = getBudgetProgress(project)
              const isOverBudget = budgetProgress > 90
              const members = safeArray(project.members)
              const memberCount = members.length
              const spent = project.actualSpent || project.spent || 0
              const total = project.totalBudget || project.budget || 0

              return (
                <Card
                  key={projectId}
                  className="cursor-pointer"
                  onClick={() => handleEnterProject(projectId)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">
                          {project.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={isProjectOwner(project) ? "default" : "secondary"} className="text-xs">
                            {isProjectOwner(project) ? "Owner" : "Member"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Users className="h-3 w-3 mr-1" />
                            {memberCount}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <CardDescription className="line-clamp-2">{project.description || 'No description'}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {total > 0 && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Budget Progress</span>
                          <span className="font-medium">
                            ${spent.toLocaleString()} / ${total.toLocaleString()}
                          </span>
                        </div>
                        <Progress value={budgetProgress} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">{budgetProgress.toFixed(1)}% utilized</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <CreateProjectModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        onSuccess={handleProjectCreated}
      />
      <JoinProjectModal 
        open={showJoinModal} 
        onOpenChange={setShowJoinModal}
        onSuccess={loadProjects}
      />
    </div>
  )
}

