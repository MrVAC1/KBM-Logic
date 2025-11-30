import { useEffect } from "react"
import { Outlet, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { AppSidebar } from "./app-sidebar"
import { useProject } from "@/contexts/ProjectContext"
import { ProjectOverview } from "@/components/project-overview"

export default function WorkspaceLayout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { loadProject, currentProject, loading, error, isPendingAccess } = useProject()

  useEffect(() => {
    // Get active project from URL search params or localStorage
    const projectIdFromUrl = searchParams.get('project')
    const activeProjectId = projectIdFromUrl || localStorage.getItem('activeProjectId')
    
    if (activeProjectId && !currentProject && !loading) {
      // Store in localStorage for persistence
      if (!localStorage.getItem('activeProjectId')) {
        localStorage.setItem('activeProjectId', activeProjectId)
      }
      loadProject(activeProjectId).catch((err) => {
        console.error('Failed to load project:', err)
        // Error handling is done in ProjectContext
      })
    } else if (!activeProjectId && !loading) {
      // No project selected, redirect to projects list
      navigate('/projects')
    }
  }, [loadProject, currentProject, loading, navigate, searchParams])

  // Handle ACCESS_DENIED error - redirect to portfolio with toast
  useEffect(() => {
    if (error === 'ACCESS_DENIED') {
      toast.error('Access Denied. Please join the project first.', {
        duration: 5000,
      })
      navigate('/projects', { replace: true })
    }
  }, [error, navigate])

  // Show loading state while loading project
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  // Show error state (non-access-denied errors)
  if (error && error !== 'ACCESS_DENIED') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <button 
            onClick={() => navigate('/projects')}
            className="text-primary hover:underline"
          >
            Go to Projects
          </button>
        </div>
      </div>
    )
  }

  // No project loaded yet
  if (!currentProject) {
    return null
  }

  // Show Project Overview for pending/guest users (Safe View)
  // Check both isPendingAccess() and isSafeView flag
  // GUESTS DO NOT SEE SIDEBAR - Only ProjectOverview
  if (isPendingAccess() || currentProject?.isSafeView) {
    return (
      <div className="min-h-screen bg-background">
        <ProjectOverview project={currentProject} />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto h-full">
        <Outlet />
      </main>
    </div>
  )
}

