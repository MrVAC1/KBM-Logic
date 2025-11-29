import { useState, useMemo } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  FolderKanban,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  LogOut,
  ShieldAlert,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { useProject } from "@/contexts/ProjectContext"

// Navigation items with required permissions
const navigationItems = [
  { 
    name: "Projects", 
    href: "/projects", 
    icon: LayoutDashboard,
    permission: null, // Always visible
  },
  { 
    name: "Financial", 
    href: "/workspace/financial", 
    icon: TrendingUp,
    permission: "can_view_financial",
  },
  { 
    name: "Kanban", 
    href: "/workspace/kanban", 
    icon: FolderKanban,
    permission: "can_view_tasks",
  },
  { 
    name: "Risks", 
    href: "/workspace/risks", 
    icon: AlertTriangle,
    permission: "can_view_risks",
  },
  { 
    name: "Settings", 
    href: "/workspace/settings", 
    icon: Settings,
    permission: "can_manage_settings",
  },
]

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [showInvitesModal, setShowInvitesModal] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { hasPermission, getUserRole, hasAnyAccess, currentProject } = useProject()

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  // Filter navigation items based on permissions
  const visibleNavigation = useMemo(() => {
    return navigationItems.filter(item => {
      // Projects page is always visible
      if (item.permission === null) {
        return true
      }
      // Check if user has permission for this item
      return hasPermission(item.permission)
    })
  }, [hasPermission])

  const userRole = getUserRole()
  const showAccessWarning = !hasAnyAccess() && currentProject

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo & Collapse Toggle */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              KBM
            </div>
            <span className="font-semibold text-lg">Logic</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* Invites Button - Prominent placement */}
          {!collapsed && currentProject && hasPermission('can_invite_users') && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => navigate(`/workspace/settings?tab=invites`)}
              title="Manage Invites"
            >
              <UserPlus className="h-3 w-3 mr-1" />
              Invites
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>
      </div>

      {/* Access Warning Banner */}
      {showAccessWarning && !collapsed && (
        <div className="mx-2 mt-2 rounded-lg border border-warning/50 bg-warning/10 p-3">
          <div className="flex items-center gap-2 text-warning">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">Limited Access</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Ask your PM for permissions
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {visibleNavigation.map((item) => {
          const isActive = location.pathname.startsWith(item.href)
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
        
        {/* Show message if no workspace items are visible */}
        {visibleNavigation.length === 1 && !collapsed && (
          <div className="px-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">
              No workspace access yet
            </p>
          </div>
        )}
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.photoURL || "/placeholder.svg"} alt={user?.displayName || "User"} />
            <AvatarFallback>{(user?.displayName || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.displayName || "User"}</p>
              <div className="flex items-center gap-1">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {userRole}
                </Badge>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
            <span className="sr-only">Log out</span>
          </Button>
        </div>
      </div>
    </aside>
  )
}

