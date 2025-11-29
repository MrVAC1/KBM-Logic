import { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, DollarSign, Calendar } from "lucide-react"
import { Area, Line, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { mockProjects, mockTransactions, mockFixedCosts } from "@/lib/mock-data"
import { ManageFundsModal } from "@/components/manage-funds-modal"
import { FixedCostsModal } from "@/components/fixed-costs-modal"
import { BudgetBreakdownModal } from "@/components/budget-breakdown-modal"
import { TransactionLogDrawer } from "@/components/transaction-log-drawer"

export default function FinancialDashboardPage() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get("project")
  const [showManageFunds, setShowManageFunds] = useState(false)
  const [showFixedCosts, setShowFixedCosts] = useState(false)
  const [showBudgetBreakdown, setShowBudgetBreakdown] = useState(false)
  const [showTransactionLog, setShowTransactionLog] = useState(false)
  const [project, setProject] = useState(mockProjects[0] || null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  // TODO: Replace with API call
  // useEffect(() => {
  //   if (projectId) {
  //     projects.getById(projectId).then(res => setProject(res.data))
  //     financials.getStats(projectId).then(res => setStats(res.data))
  //   }
  // }, [projectId])

  // CRITICAL: All hooks (including useMemo) must be called before any early returns
  // Calculate EVM data with useMemo (must be before early return)
  const evmData = useMemo(() => {
    // Return empty data if project is not available
    if (!project) {
      return []
    }
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"]
    const data = []

    let plannedCumulative = 0
    let actualCumulative = 0

    // Safe navigation - use defaults if values are missing
    const totalBudget = project?.totalBudget || 0
    const actualSpent = project?.actualSpent || 0

    const monthlyPlannedBudget = totalBudget / 12
    const monthlyActual = actualSpent / 6 // Spread actual over 6 months

    for (let i = 0; i < months.length; i++) {
      plannedCumulative += monthlyPlannedBudget
      actualCumulative += monthlyActual + (Math.random() * 5000 - 2500) // Add variance

      data.push({
        month: months[i],
        planned: Math.round(plannedCumulative),
        actual: Math.round(actualCumulative),
      })
    }

    return data
  }, [project])

  // Safe navigation for all project property accesses
  const safeProjectId = project?.id || project?._id
  const safeTotalBudget = project?.totalBudget || 0
  const safeActualSpent = project?.actualSpent || 0

  const totalTransactions = mockTransactions.filter((t) => t.projectId === safeProjectId)
  const income = totalTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
  const expenses = totalTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)
  const totalFixedCosts = mockFixedCosts.reduce((sum, c) => sum + c.amount, 0)

  const budgetHealth = safeTotalBudget > 0 
    ? ((safeTotalBudget - safeActualSpent) / safeTotalBudget) * 100 
    : 0
  const isOverBudget = budgetHealth < 10

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Financial Dashboard</h1>
              <p className="mt-2 text-muted-foreground">Earned Value Management & Budget Tracking</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowFixedCosts(true)}>
                Fixed Costs
              </Button>
              <Button onClick={() => setShowManageFunds(true)}>
                <DollarSign className="mr-2 h-4 w-4" />
                Manage Funds
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Budget Overview Cards */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => setShowTransactionLog(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Budget</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">${safeTotalBudget.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">Click to view transaction history</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Actual Spent</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${safeActualSpent.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {safeTotalBudget > 0 ? ((safeActualSpent / safeTotalBudget) * 100).toFixed(1) : '0'}% of budget
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${isOverBudget ? "text-warning" : "text-foreground"}`}>
                ${(safeTotalBudget - safeActualSpent).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{budgetHealth.toFixed(1)}% remaining</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fixed Costs/Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalFixedCosts.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">{mockFixedCosts.length} recurring costs</p>
            </CardContent>
          </Card>
        </div>

        {/* EVM S-Curve Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Earned Value Management - Plan vs Actual</CardTitle>
            <CardDescription>S-Curve showing planned budget baseline vs actual spending</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="cursor-pointer rounded-lg border border-transparent hover:border-primary/50 p-2 -m-2 transition-colors"
              onClick={() => setShowBudgetBreakdown(true)}
            >
              <div className="h-[400px] bg-slate-950 rounded-lg p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evmData}>
                    <defs>
                      {/* High-Contrast Neon Gradient for Planned */}
                      <linearGradient id="plannedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.1} />
                      </linearGradient>
                      {/* Actual Line Gradient */}
                      <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeWidth={1} strokeOpacity={0.3} />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--foreground))"
                      fontSize={12}
                      fontWeight={600}
                      tick={{ fill: "hsl(var(--foreground))" }}
                    />
                    <YAxis
                      stroke="hsl(var(--foreground))"
                      fontSize={12}
                      fontWeight={600}
                      tick={{ fill: "hsl(var(--foreground))" }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                      formatter={(value: number | null, name: string) => {
                        if (value === null) return ["N/A", name]
                        return [`$${value.toLocaleString()}`, name]
                      }}
                      labelFormatter={(label, payload) => {
                        if (!payload || payload.length === 0) return label
                        const data = payload[0].payload
                        const planned = data.planned
                        const actual = data.actual
                        if (actual !== null) {
                          const variance = actual - planned
                          return `${label} - Variance: ${variance >= 0 ? "+" : ""}$${variance.toLocaleString()}`
                        }
                        return label
                      }}
                    />
                    {/* Planned line - bright cyan dotted line */}
                    <Line
                      type="monotone"
                      dataKey="planned"
                      stroke="#06b6d4"
                      strokeWidth={3}
                      strokeDasharray="5 5"
                      dot={{ fill: "#06b6d4", r: 4 }}
                      name="Planned"
                    />
                    {/* Planned area - cyan gradient fill */}
                    <Area
                      type="monotone"
                      dataKey="planned"
                      stroke="none"
                      fillOpacity={0.3}
                      fill="url(#plannedGradient)"
                      name="Planned"
                    />
                    {/* Actual area - bright blue gradient */}
                    <Area
                      type="monotone"
                      dataKey="actual"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#actualGradient)"
                      dot={{ fill: "#3b82f6", r: 4 }}
                      name="Actual"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-cyan-500 ring-2 ring-cyan-500/30" />
                  <span className="text-sm font-medium text-cyan-400">Planned (Baseline)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 ring-2 ring-blue-500/30" />
                  <span className="text-sm font-medium text-blue-400">Actual Spent</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ManageFundsModal open={showManageFunds} onOpenChange={setShowManageFunds} />
      <FixedCostsModal open={showFixedCosts} onOpenChange={setShowFixedCosts} />
      <BudgetBreakdownModal open={showBudgetBreakdown} onOpenChange={setShowBudgetBreakdown} />
      <TransactionLogDrawer open={showTransactionLog} onOpenChange={setShowTransactionLog} />
    </div>
  )
}
