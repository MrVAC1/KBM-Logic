import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface Member {
  userId?: any
  roleName?: string
  permissions?: string[]
  joinedAt?: string
  _id?: string
}

interface ProjectMembersModalProps {
  isOpen: boolean
  onClose: () => void
  members: Member[]
}

// Helper to get role badge styling
const getRoleBadgeStyle = (roleName: string) => {
  switch (roleName?.toLowerCase()) {
    case 'owner':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    case 'pm':
    case 'project manager':
      return 'bg-green-500/10 text-green-400 border-green-500/30'
    case 'admin':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    case 'developer':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
    case 'guest':
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  }
}

export function ProjectMembersModal({ isOpen, onClose, members }: ProjectMembersModalProps) {
  // Helper to get member user info
  const getMemberUser = (member: Member) => {
    const userId = member.userId
    if (typeof userId === 'object' && userId !== null) {
      // Populated user object
      return {
        name: userId.displayName || userId.email || 'Unknown',
        email: userId.email || null,
        avatar: userId.avatar || userId.photoURL || null,
      }
    }
    // Fallback if not populated
    return {
      name: 'Unknown User',
      email: null,
      avatar: null,
    }
  }

  const getMemberRole = (member: Member) => {
    return member.roleName || 'Guest'
  }

  const memberCount = members?.length || 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-950 border-slate-800 shadow-2xl">
        <DialogHeader className="pb-4 border-b border-slate-800">
          <DialogTitle className="text-slate-100">
            Project Members
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            All members of this project ({memberCount} {memberCount === 1 ? 'member' : 'members'})
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-2 mt-4">
            {members && members.length > 0 ? (
              members.map((member, index) => {
                const user = getMemberUser(member)
                const role = getMemberRole(member)
                const badgeStyle = getRoleBadgeStyle(role)
                
                return (
                  <div
                    key={member._id || member.userId?._id || index}
                    className="flex items-center gap-4 p-3 rounded-lg border border-slate-800/50 bg-slate-900/50 hover:bg-slate-800/50 hover:border-slate-700 transition-all duration-200 cursor-default"
                  >
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 shrink-0 ring-2 ring-slate-800">
                      <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                      <AvatarFallback className="bg-slate-800 text-slate-200 border border-slate-700">
                        {user.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    {/* Name and Email */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {user.name}
                      </p>
                      {user.email && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {user.email}
                        </p>
                      )}
                    </div>
                    
                    {/* Role Badge */}
                    <Badge 
                      variant="outline" 
                      className={`shrink-0 ${badgeStyle}`}
                    >
                      {role}
                    </Badge>
                  </div>
                )
              })
            ) : (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-slate-400">No members found</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="flex justify-end pt-4 border-t border-slate-800 mt-4">
          <Button 
            onClick={onClose}
            variant="ghost"
            className="text-slate-300 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent hover:border-slate-700"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

