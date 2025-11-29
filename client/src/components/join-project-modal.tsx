"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Lock } from "lucide-react"
import { projects as projectsAPI } from "@/services/api"
import { toast } from "sonner"

interface JoinProjectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function JoinProjectModal({ open, onOpenChange, onSuccess }: JoinProjectModalProps) {
  const [projectId, setProjectId] = useState("")
  const [password, setPassword] = useState("")
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!projectId || !password) {
      setError("Please enter both Project ID and password")
      return
    }

    setIsJoining(true)
    setError("")

    try {
      const response = await projectsAPI.join(projectId, password)
      
      toast.success(response.data?.message || "Successfully joined project!")
      
      // Reset form
      setProjectId("")
      setPassword("")
      
      // Close modal
      onOpenChange(false)
      
      // Call success callback to refresh projects list
      if (onSuccess) {
        onSuccess()
      }
      
      // Redirect to project workspace (Gateway will show ProjectOverview for Guests)
      // Wait a moment for projects list to refresh, then navigate
      setTimeout(() => {
        window.location.href = `/workspace/kanban?project=${projectId}`
      }, 500)
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Failed to join project. Please check your Project ID and password."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Join Existing Project</DialogTitle>
          <DialogDescription>
            Enter the Project ID and access password to join a team
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleJoin} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-id">Project ID *</Label>
            <Input
              id="project-id"
              placeholder="Enter project ID"
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value)
                setError("")
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="join-password">Access Password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="join-password"
                type="password"
                placeholder="Enter project password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError("")
                }}
                className="pl-9"
                required
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </form>

        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => {
              onOpenChange(false)
              setProjectId("")
              setPassword("")
              setError("")
            }}
            disabled={isJoining}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleJoin} 
            disabled={!projectId || !password || isJoining}
          >
            {isJoining ? "Joining..." : "Join Project"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
