import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { User, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/AuthContext"
import { OnboardingModal } from "@/components/onboarding-modal"

export function UserNav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  if (!user) {
    return null
  }

  const displayName = user.displayName || user.email?.split('@')[0] || "User"

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative flex items-center justify-center rounded-full md:gap-2 md:border md:border-cyan-500/30 md:px-3 md:py-1 transition-all duration-200 md:hover:bg-cyan-500/10 md:hover:border-cyan-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <span className="hidden md:block text-sm font-medium text-foreground">
              {displayName}
            </span>
            <Avatar className="h-9 w-9 md:h-8 md:w-8">
              <AvatarImage 
                src={user.photoURL || "/placeholder.svg"} 
                alt={displayName} 
              />
              <AvatarFallback>
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {displayName}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setShowOnboardingModal(true)}>
              <User className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            variant="destructive"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <OnboardingModal open={showOnboardingModal} onOpenChange={setShowOnboardingModal} />
    </>
  )
}

