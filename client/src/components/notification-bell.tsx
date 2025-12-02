import { useState, useEffect } from "react"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { notifications as notificationsAPI } from "@/services/api"
import { useParams, useLocation } from "react-router-dom"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { useProject } from "@/contexts/ProjectContext"

export function NotificationBell() {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>()
  const location = useLocation()
  const { currentProject } = useProject()
  
  // Determine if we're in workspace: check if we're on a /workspace/* route
  const isInWorkspace = location.pathname.startsWith('/workspace') || Boolean(urlProjectId)
  const currentProjectId = urlProjectId || currentProject?.id || currentProject?._id
  
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Helper function to normalize notifications data
  const normalizeNotifications = (data: any): any[] => {
    if (Array.isArray(data)) {
      return data
    }
    if (data?.data && Array.isArray(data.data)) {
      return data.data
    }
    return []
  }

  // Fetch unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await notificationsAPI.getUnreadCount(currentProjectId || null)
      setUnreadCount(response.data.count || 0)
    } catch (error: any) {
      console.error("Failed to fetch unread count:", error)
    }
  }

  // Fetch notifications
  const fetchNotifications = async () => {
    setLoading(true)
    try {
      let response
      
      // If in workspace, filter by current project. Otherwise, show all.
      if (isInWorkspace && currentProjectId) {
        response = await notificationsAPI.getByProject(currentProjectId, { limit: 20 })
      } else {
        // Global view: fetch all notifications from all projects
        response = await notificationsAPI.getAll({ limit: 20 })
      }
      
      // Normalize the response data to ensure it's always an array
      const notificationsData = normalizeNotifications(response.data)
      setNotifications(notificationsData)
    } catch (error: any) {
      console.error("Failed to fetch notifications:", error)
      toast.error("Failed to load notifications")
      setNotifications([]) // Ensure notifications is always an array
    } finally {
      setLoading(false)
    }
  }

  // Initial fetch and polling
  useEffect(() => {
    fetchUnreadCount()
    
    // Poll every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount()
      if (isOpen) {
        fetchNotifications()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [currentProjectId, isOpen])

  // Fetch notifications when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, currentProjectId, isInWorkspace])

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsAPI.markAsRead(notificationId)
      setNotifications(prev => {
        if (!Array.isArray(prev)) return []
        return prev.map((n: any) => n._id === notificationId ? { ...n, isRead: true } : n)
      })
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error: any) {
      console.error("Failed to mark notification as read:", error)
      toast.error("Failed to mark notification as read")
    }
  }

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead(currentProjectId || null)
      setNotifications(prev => {
        if (!Array.isArray(prev)) return []
        return prev.map((n: any) => ({ ...n, isRead: true }))
      })
      setUnreadCount(0)
      toast.success("All notifications marked as read")
    } catch (error: any) {
      console.error("Failed to mark all as read:", error)
      toast.error("Failed to mark all notifications as read")
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h4 className="font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="h-8 text-xs"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <ScrollArea className="h-96">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !Array.isArray(notifications) || notifications.length === 0 ? (
            <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification: any) => (
                <div
                  key={notification._id}
                  className={`p-4 hover:bg-accent cursor-pointer transition-colors ${
                    !notification.isRead ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => !notification.isRead && handleMarkAsRead(notification._id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-1 ${!notification.isRead ? 'font-medium' : ''}`}>
                      <p className="text-sm">{notification.message}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                        {/* Show project badge if in global view (not in workspace) or if project is different */}
                        {(!isInWorkspace || (notification.projectId && 
                          (typeof notification.projectId === 'object' 
                            ? (notification.projectId._id?.toString() !== currentProjectId?.toString())
                            : notification.projectId?.toString() !== currentProjectId?.toString()))) && 
                         (typeof notification.projectId === 'object' ? notification.projectId?.name : null) && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0 h-5 bg-slate-800/50 border-slate-700">
                            {typeof notification.projectId === 'object' ? notification.projectId.name : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {!notification.isRead && (
                      <div className="h-2 w-2 rounded-full bg-primary mt-1" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

