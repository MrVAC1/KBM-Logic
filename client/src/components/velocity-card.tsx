import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { velocity as velocityAPI } from "@/services/api"
import { useProject } from "@/contexts/ProjectContext"

interface VelocityCardProps {
  projectId: string
  period?: 'week' | 'month' | 'year'
}

export function VelocityCard({ projectId, period = 'week' }: VelocityCardProps) {
  const { currentProject } = useProject()
  const [velocities, setVelocities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchVelocities = async () => {
      try {
        setLoading(true)
        const response = await velocityAPI.getProjectMembers(projectId, period)
        setVelocities(response.data?.data || response.data || [])
      } catch (error: any) {
        console.error("Failed to fetch velocities:", error)
      } finally {
        setLoading(false)
      }
    }

    if (projectId) {
      fetchVelocities()
    }
  }, [projectId, period])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Velocity</CardTitle>
          <CardDescription>Loading velocity data...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (velocities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Velocity</CardTitle>
          <CardDescription>No velocity data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Velocity</CardTitle>
        <CardDescription>
          Work delivered vs capacity for the last {period}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {velocities.map((velocity: any) => {
          const member = currentProject?.members?.find(
            (m: any) => m.userId?._id === velocity.userId || m.userId === velocity.userId
          )
          
          if (!member) return null

          const user = member.userId || member
          const displayName = user?.displayName || user?.email?.split('@')[0] || 'Unknown'
          const avatar = user?.avatar || user?.photoURL

          const ratioColor = velocity.isUnderperforming 
            ? "text-destructive" 
            : velocity.velocityRatio >= 80 
            ? "text-green-400" 
            : "text-yellow-400"

          return (
            <div
              key={velocity.userId}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                velocity.isUnderperforming 
                  ? 'border-destructive/50 bg-destructive/5' 
                  : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatar} alt={displayName} />
                  <AvatarFallback>
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{displayName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {velocity.isUnderperforming ? (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Low Velocity
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        {velocity.velocityRatio.toFixed(0)}% Capacity
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-lg font-bold ${ratioColor}`}>
                  {velocity.deliveredHours.toFixed(1)}h / {velocity.capacity.toFixed(1)}h
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  {velocity.velocityRatio >= 50 ? (
                    <TrendingUp className="h-3 w-3 text-green-400" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive" />
                  )}
                  <span>{velocity.velocityRatio.toFixed(0)}% delivered</span>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

