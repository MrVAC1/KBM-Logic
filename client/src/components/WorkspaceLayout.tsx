import { useEffect, useRef } from "react"
import { Outlet, useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { AppSidebar } from "./app-sidebar"
import { useProject } from "@/contexts/ProjectContext"
import { ProjectOverview } from "@/components/project-overview"

export default function WorkspaceLayout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { loadProject, currentProject, loading, error, isPendingAccess } = useProject()

  // Use refs to track state and prevent infinite loops
  const lastLoadedProjectIdRef = useRef<string | null>(null)
  const isLoadingRef = useRef(false)
  const lastErrorRef = useRef<string | null>(null)

  useEffect(() => {
    // Get active project from URL search params or localStorage
    const projectIdFromUrl = searchParams.get('project')
    const activeProjectId = projectIdFromUrl || localStorage.getItem('activeProjectId')
    
    // Prevent infinite loop: check if we already have the correct project loaded
    const currentProjectId = currentProject?.id || currentProject?._id
    
    // If we're already loading this exact project, skip
    if (isLoadingRef.current && lastLoadedProjectIdRef.current === activeProjectId) {
      return
    }
    
    // If we just loaded this project successfully, skip
    if (lastLoadedProjectIdRef.current === activeProjectId && currentProjectId === activeProjectId && !loading) {
      return
    }
    
    // If we had an error for this project and it's the same error, skip to prevent retry loop
    if (lastErrorRef.current === error && error && lastLoadedProjectIdRef.current === activeProjectId) {
      return
    }
    
    if (activeProjectId && !loading) {
      // Only load if we don't have a project OR if the project ID doesn't match
      if (!currentProject || currentProjectId !== activeProjectId) {
        // Store in localStorage for persistence
        if (!localStorage.getItem('activeProjectId')) {
          localStorage.setItem('activeProjectId', activeProjectId)
        }
        
        // Mark as loading to prevent duplicate calls
        isLoadingRef.current = true
        lastLoadedProjectIdRef.current = activeProjectId
        lastErrorRef.current = null
        
        loadProject(activeProjectId)
          .then(() => {
            isLoadingRef.current = false
            lastErrorRef.current = null
          })
          .catch((err) => {
            console.error('Failed to load project:', err)
            
            // Handle 429 (Too Many Requests) - clear and stop retrying
            if (err.response?.status === 429) {
              console.warn('Rate limit exceeded, clearing project ID to prevent infinite retries')
              localStorage.removeItem('activeProjectId')
              lastLoadedProjectIdRef.current = null
              lastErrorRef.current = 'RATE_LIMIT'
            } else {
              lastErrorRef.current = err.response?.status?.toString() || 'ERROR'
            }
            
            isLoadingRef.current = false
            // Error handling is done in ProjectContext
          })
      } else {
        // Project already loaded and matches
        lastLoadedProjectIdRef.current = activeProjectId
        lastErrorRef.current = null
      }
    } else if (!activeProjectId && !loading && !currentProject) {
      // No project selected and no project loaded, redirect to projects list
      lastLoadedProjectIdRef.current = null
      lastErrorRef.current = null
      navigate('/projects')
    }
  }, [loadProject, currentProject, loading, navigate, searchParams, error])

  // Handle ACCESS_DENIED and RATE_LIMIT errors - redirect to portfolio with toast
  useEffect(() => {
    if (error === 'ACCESS_DENIED') {
      toast.error('Access Denied. Please join the project first.', {
        duration: 5000,
      })
      navigate('/projects', { replace: true })
    } else if (error === 'RATE_LIMIT_EXCEEDED') {
      toast.error('Too many requests. Please wait a moment and try again.', {
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

