import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { mockTasks, mockProjects, mockUsers } from "@/lib/mock-data"
import { TasksInRiskBucketModal } from "@/components/tasks-in-risk-bucket-modal"
import { Zap, AlertTriangle } from "lucide-react"

export default function RisksPage() {
  const [selectedCell, setSelectedCell] = useState<{ probability: number; impact: number } | null>(null)

  const project = mockProjects[0]

  // Calculate if task should be auto-adjusted
  const getAutoAdjustedTasks = useMemo(() => {
    return mockTasks.map((task) => {
      const budgetUsage = (project.actualSpent / project.totalBudget) * 100
      const daysUntilDeadline = Math.ceil(
        (new Date(task.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      )

      const shouldAutoAdjust = budgetUsage > 90 || daysUntilDeadline < 2

      return {
        ...task,
        isAutoAdjusted: shouldAutoAdjust,
        autoAdjustReason: shouldAutoAdjust ? (budgetUsage > 90 ? "Budget > 90%" : "Deadline < 2 days") : null,
      }
    })
  }, [project])

  // Group tasks by risk score
  const tasksByRisk = useMemo(() => {
    const matrix: Record<string, typeof getAutoAdjustedTasks> = {}
    getAutoAdjustedTasks.forEach((task) => {
      const key = `${task.riskProbability}-${task.riskImpact}`
      if (!matrix[key]) matrix[key] = []
      matrix[key].push(task)
    })
    return matrix
  }, [getAutoAdjustedTasks])

  const getRiskColor = (probability: number, impact: number) => {
    const score = probability * impact
    // Green (Low Risk): 1-5
    if (score <= 5) {
      return "bg-green-500/20 hover:bg-green-500/30 border-green-500/40"
    }
    // Yellow (Medium Risk): 6-11
    if (score <= 11) {
      return "bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/40"
    }
    // Orange (High Risk): 12-19
    if (score <= 19) {
      return "bg-orange-500/20 hover:bg-orange-500/30 border-orange-500/40"
    }
    // Red (Critical Risk): 20-25
    return "bg-red-500/20 hover:bg-red-500/30 border-red-500/40"
  }

  const getCellTextColor = (probability: number, impact: number) => {
    const score = probability * impact
    if (score <= 5) return "text-green-500"
    if (score <= 11) return "text-yellow-500"
    if (score <= 19) return "text-orange-500"
    return "text-red-500"
  }

  const getCellTasks = (probability: number, impact: number) => {
    return tasksByRisk[`${probability}-${impact}`] || []
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Risk Management</h1>
            <p className="mt-2 text-muted-foreground">Dynamic KBM risk matrix with auto-adjustment</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        {/* Legend */}
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-[#22c55e]" />
            <span className="text-sm text-muted-foreground">Low (1-2)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-[#84cc16]" />
            <span className="text-sm text-muted-foreground">Low-Med (3-5)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-[#facc15]" />
            <span className="text-sm text-muted-foreground">Medium (6-9)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-[#f97316]" />
            <span className="text-sm text-muted-foreground">High (10-14)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-[#ea580c]" />
            <span className="text-sm text-muted-foreground">Very High (15-19)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-[#dc2626]" />
            <span className="text-sm text-muted-foreground">Critical (20-25)</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary">
              <Zap className="h-3 w-3 mr-1" />
              Auto-Adjusted
            </Badge>
          </div>
        </div>

        {/* 5x5 Heatmap */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Heatmap (5×5)</CardTitle>
            <CardDescription>Click any cell to view tasks in that risk category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                {/* Impact Label (Top) */}
                <div className="flex items-center mb-2">
                  <div className="w-24 shrink-0" />
                  <div className="flex-1 text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">IMPACT →</p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex-1 text-center">
                          <span className="text-xs text-muted-foreground">{i}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Matrix Grid */}
                <div className="flex">
                  {/* Probability Label (Left) */}
                  <div className="w-24 shrink-0 flex flex-col justify-center items-center">
                    <div className="transform -rotate-90 whitespace-nowrap">
                      <p className="text-sm font-medium text-muted-foreground">← PROBABILITY</p>
                    </div>
                  </div>

                  {/* Grid Cells */}
                  <div className="flex-1">
                    {[5, 4, 3, 2, 1].map((probability) => (
                      <div key={probability} className="flex mb-2 last:mb-0">
                        <div className="w-12 flex items-center justify-center shrink-0">
                          <span className="text-xs text-muted-foreground">{probability}</span>
                        </div>
                        {[1, 2, 3, 4, 5].map((impact) => {
                          const tasks = getCellTasks(probability, impact)
                          const score = probability * impact

                          return (
                            <button
                              key={`${probability}-${impact}`}
                              onClick={() => setSelectedCell({ probability, impact })}
                              className={`
                                flex-1 aspect-square rounded-lg border-2 transition-all
                                flex flex-col items-center justify-center p-2
                                ${getRiskColor(probability, impact)}
                                ${tasks.length > 0 ? "cursor-pointer" : "cursor-default opacity-60"}
                              `}
                            >
                              <div className={`text-2xl font-bold mb-1 ${getCellTextColor(probability, impact)}`}>
                                {score}
                              </div>
                              {tasks.length > 0 && (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {tasks.slice(0, 3).map((task) => (
                                    <Badge key={task.id} variant="secondary" className="text-xs px-1 py-0">
                                      {task.title.slice(0, 3).toUpperCase()}
                                    </Badge>
                                  ))}
                                  {tasks.length > 3 && (
                                    <Badge variant="secondary" className="text-xs px-1 py-0">
                                      +{tasks.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Register Table */}
        <Card>
          <CardHeader>
            <CardTitle>Risk Register</CardTitle>
            <CardDescription>Detailed list of all tasks with risk assessments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {getAutoAdjustedTasks.map((task) => {
                const assignedUsers = mockUsers.filter((u) => task.assignees.includes(u.id))
                const riskScore = task.riskProbability * task.riskImpact

                return (
                  <Card
                    key={task.id}
                    className="border-l-4"
                    style={{ borderLeftColor: getRiskColor(task.riskProbability, task.riskImpact).replace("bg-", "#") }}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-start gap-2">
                            <h4 className="font-medium">{task.title}</h4>
                            {task.isAutoAdjusted && (
                              <Badge variant="outline" className="bg-primary/10 text-primary border-primary">
                                <Zap className="h-3 w-3 mr-1" />
                                Auto-Adjusted
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          {task.isAutoAdjusted && (
                            <p className="text-xs text-warning mt-2 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {task.autoAdjustReason}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0 space-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Risk Score</p>
                            <p className="text-2xl font-bold">{riskScore}</p>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">P</p>
                              <p className="font-medium">{task.riskProbability}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">I</p>
                              <p className="font-medium">{task.riskImpact}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                        <span>Assignees: {assignedUsers.map((u) => u.nickname).join(", ") || "Unassigned"}</span>
                        <span>•</span>
                        <span>Deadline: {new Date(task.deadline).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedCell && (
        <TasksInRiskBucketModal
          probability={selectedCell.probability}
          impact={selectedCell.impact}
          tasks={getCellTasks(selectedCell.probability, selectedCell.impact)}
          open={!!selectedCell}
          onOpenChange={(open) => !open && setSelectedCell(null)}
        />
      )}
    </div>
  )
}
