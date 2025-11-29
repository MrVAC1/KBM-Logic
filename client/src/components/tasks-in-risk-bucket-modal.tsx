"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Clock, Users, Zap } from "lucide-react"
import type { Task } from "@/lib/mock-data"
import { mockUsers } from "@/lib/mock-data"

interface TasksInRiskBucketModalProps {
  probability: number
  impact: number
  tasks: (Task & { isAutoAdjusted?: boolean; autoAdjustReason?: string | null })[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TasksInRiskBucketModal({
  probability,
  impact,
  tasks,
  open,
  onOpenChange,
}: TasksInRiskBucketModalProps) {
  const riskScore = probability * impact
  const getRiskLabel = () => {
    if (riskScore >= 20) return { label: "Critical", color: "bg-destructive text-destructive-foreground" }
    if (riskScore >= 15) return { label: "Very High", color: "bg-[#ea580c] text-white" }
    if (riskScore >= 10) return { label: "High", color: "bg-warning text-warning-foreground" }
    if (riskScore >= 6) return { label: "Medium", color: "bg-[#facc15] text-black" }
    return { label: "Low", color: "bg-success text-success-foreground" }
  }

  const risk = getRiskLabel()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle>Risk Bucket: {risk.label}</DialogTitle>
            <Badge className={risk.color}>
              Score: {riskScore} (P:{probability} × I:{impact})
            </Badge>
          </div>
          <DialogDescription>
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"} in this risk category
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {(Array.isArray(tasks) ? tasks : []).map((task) => {
            const taskAssignees = Array.isArray(task?.assignees) ? task.assignees : []
            const assignedUsers = mockUsers.filter((u) => taskAssignees.includes(u.id))

            return (
              <Card key={task.id}>
                <CardContent className="py-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-2">
                          <h4 className="font-medium">{task.title}</h4>
                          {task.isAutoAdjusted && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary">
                              <Zap className="h-3 w-3 mr-1" />
                              Auto
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          task.complexity === "low"
                            ? "bg-success/10 text-success border-success"
                            : task.complexity === "medium"
                              ? "bg-warning/10 text-warning border-warning"
                              : "bg-destructive/10 text-destructive border-destructive"
                        }
                      >
                        {task.complexity}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <div className="flex -space-x-2">
                          {assignedUsers.length > 0 ? (
                            assignedUsers.slice(0, 3).map((user) => (
                              <Avatar key={user.id} className="h-6 w-6 border-2 border-card">
                                <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.nickname} />
                                <AvatarFallback className="text-xs">
                                  {user.nickname.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            ))
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          Due: {new Date(task.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>

                      {task.isAutoAdjusted && (
                        <Badge variant="secondary" className="text-xs">
                          {task.autoAdjustReason}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
