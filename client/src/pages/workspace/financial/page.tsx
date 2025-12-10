import { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, DollarSign, Calendar, ArrowUp, ArrowDown, Info } from "lucide-react"
import { Area, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { financials as financialsAPI } from "@/services/api"
import { useProject } from "@/contexts/ProjectContext"
import { ManageFundsModal } from "@/components/manage-funds-modal"
import { BudgetBreakdownModal } from "@/components/budget-breakdown-modal"
import { TransactionLogDrawer } from "@/components/transaction-log-drawer"
import { InvestorReportModal } from "@/components/investor-report-modal"
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { VelocityCard } from "@/components/velocity-card"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"

export default function FinancialDashboardPage() {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>()
  const [searchParams] = useSearchParams()
  const { currentProject, hasPermission } = useProject()
  const projectId = urlProjectId || searchParams.get("project") || currentProject?.id || currentProject?._id
  const canViewFinancial = hasPermission('can_view_financial')
  const [showManageFunds, setShowManageFunds] = useState(false)
  const [showBudgetBreakdown, setShowBudgetBreakdown] = useState(false)
  const [showTransactionLog, setShowTransactionLog] = useState(false)
  const [showInvestorReport, setShowInvestorReport] = useState(false)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [chartLoading, setChartLoading] = useState(false)
  const [transactionRefreshTrigger, setTransactionRefreshTrigger] = useState(0)
  
  // Date range filter state
  type DateRangeType = 'last_30_days' | 'this_month' | 'this_year' | 'all_time'
  const [dateRange, setDateRange] = useState<DateRangeType>('this_month')
  
  // Calculate date range based on selection
  const getDateRange = useMemo(() => {
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    
    let from: Date
    let to: Date = today
    
    switch (dateRange) {
      case 'last_30_days':
        from = new Date(today)
        from.setDate(from.getDate() - 30)
        from.setHours(0, 0, 0, 0)
        break
      case 'this_month':
        from = new Date(today.getFullYear(), today.getMonth(), 1)
        from.setHours(0, 0, 0, 0)
        break
      case 'this_year':
        from = new Date(today.getFullYear(), 0, 1)
        from.setHours(0, 0, 0, 0)
        break
      case 'all_time':
        // Use project start date if available, otherwise use 1 year ago
        const projectStart = currentProject?.createdAt 
          ? new Date(currentProject.createdAt)
          : new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
        from = new Date(projectStart)
        from.setHours(0, 0, 0, 0)
        // Use project deadline if available, otherwise use today
        if (currentProject?.deadline) {
          to = new Date(currentProject.deadline)
          to.setHours(23, 59, 59, 999)
        }
        break
      default:
        from = new Date(today.getFullYear(), today.getMonth(), 1)
        from.setHours(0, 0, 0, 0)
    }
    
    return { from, to }
  }, [dateRange, currentProject])
  
  // Format date range for display
  const dateRangeLabel = useMemo(() => {
    const { from, to } = getDateRange
    return `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`
  }, [getDateRange])

  // Fetch summary stats (fast load for metric cards)
  const fetchSummaryStats = async () => {
    if (!projectId) return

    setLoading(true)
    try {
      const { from, to } = getDateRange
      const response = await financialsAPI.getSummaryStats(projectId, from, to)
      const data = response.data?.data || response.data
      setStats((prev: any) => ({
        ...prev,
        ...data,
      }))
    } catch (error: any) {
      console.error('Failed to fetch summary stats:', error)
      toast.error('Could not load financial metrics. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch chart data (delayed load for S-Curve)
  const fetchChartData = async () => {
    if (!projectId) return

    setChartLoading(true)
    try {
      const { from, to } = getDateRange
      const response = await financialsAPI.getChartData(projectId, from, to)
      const data = response.data?.data || response.data
      setStats((prev: any) => ({
        ...prev,
        evmDataPoints: data.evmDataPoints || [],
        plannedValueCurve: data.plannedValueCurve || [],
      }))
    } catch (error: any) {
      console.error('Failed to fetch chart data:', error)
      toast.error('Could not load chart data. Please try again.')
    } finally {
      setChartLoading(false)
    }
  }

  // Fetch both summary and chart data
  const fetchStats = async () => {
    if (!projectId) return

    // Load summary first (fast)
    await fetchSummaryStats()
    
    // Then load chart data (can be slower)
    await fetchChartData()
  }

  useEffect(() => {
    if (projectId) {
      fetchStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, dateRange])

  // Callback to refresh data after transaction creation
  const handleTransactionCreated = () => {
    fetchSummaryStats()
    fetchChartData()
    // Trigger transaction log refresh
    setTransactionRefreshTrigger(prev => prev + 1)
  }

  // Format EVM data for chart
  const evmData = useMemo(() => {
    if (!stats?.evmDataPoints || stats.evmDataPoints.length === 0) {
      return []
    }

    return stats.evmDataPoints.map((point: any) => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      PV: point.PV || 0,
      AC: point.AC || 0,
      EV: point.EV || 0,
    }))
  }, [stats])

  // Get current values with safety checks
  const currentPV = stats?.current?.PV ?? 0
  const currentAC = stats?.current?.AC ?? 0
  const currentEV = stats?.current?.EV ?? 0

  // Calculate variances with fallback
  const scheduleVariance = stats?.variances?.scheduleVariance ?? (currentEV - currentPV)
  const costVariance = stats?.variances?.costVariance ?? (currentEV - currentAC)

  // Budget calculation (includes income transactions)
  // Use API values if available, otherwise calculate from current values
  const totalAdditionalFunds = stats?.budget?.totalAdditionalFunds ?? 0
  const totalBudget = stats?.budget?.baseline 
    ? (stats.budget.baseline + totalAdditionalFunds)
    : (currentPV + totalAdditionalFunds)
  const actualSpent = currentAC || 0
  const remainingBudget = stats?.budget?.remaining ?? stats?.remaining ?? Math.max(0, totalBudget - actualSpent)
  
  // Budget health calculation (percentage of budget remaining)
  const budgetHealth = totalBudget > 0 
    ? (remainingBudget / totalBudget) * 100 
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
            <div className="flex gap-3 items-center">
              {/* Date Range Selector */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRangeType)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="this_year">This Year</SelectItem>
                    <SelectItem value="all_time">All Time</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground hidden md:inline">
                  {dateRangeLabel}
                </span>
              </div>
              {canViewFinancial && (
                <Button variant="outline" onClick={() => setShowInvestorReport(true)}>
                  Investor Report
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowTransactionLog(true)}>
                Transaction Log
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
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Loading financial data...</p>
          </div>
        ) : (
          <>
            {/* Budget Overview Cards */}
            <div className="grid gap-6 md:grid-cols-4 lg:grid-cols-6 mb-8">
              <UITooltip>
                <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Planned Value (PV)</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">${totalBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Budget baseline {dateRange !== 'all_time' && `(${dateRange.replace('_', ' ')})`}
                  </p>
                </CardContent>
              </Card>
                </TooltipTrigger>
                <TooltipContent>
                  Planned Value: Approved budget for scheduled work (Hours × Role Rate).
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Actual Cost (AC)</CardTitle>
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${actualSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {totalBudget > 0 ? ((actualSpent / totalBudget) * 100).toFixed(1) : '0'}% of PV
                    {dateRange !== 'all_time' && ` (${dateRange.replace('_', ' ')})`}
                  </p>
                </CardContent>
              </Card>
                </TooltipTrigger>
                <TooltipContent>
                  Actual Cost: Real money spent (Role Salaries + Expenses - Income) based on effective dates.
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Earned Value (EV)</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-400">${currentEV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Work completed{dateRange !== 'all_time' && ` (${dateRange.replace('_', ' ')})`}
                  </p>
                </CardContent>
              </Card>
                </TooltipTrigger>
                <TooltipContent>
                  Earned Value: Budget value of authorized work actually completed.
                </TooltipContent>
              </UITooltip>

              {/* Schedule Variance Widget */}
              <UITooltip>
                <TooltipTrigger asChild>
              <Card className={scheduleVariance < 0 ? "border-warning/50 bg-warning/5" : scheduleVariance > 0 ? "border-green-500/50 bg-green-500/5" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Schedule Variance</CardTitle>
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Difference between Earned Value and Planned Value</p>
                          <p className="text-xs mt-1">Positive = Ahead of schedule</p>
                          <p className="text-xs">Negative = Behind schedule</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
                  {scheduleVariance < 0 ? (
                    <ArrowDown className="h-4 w-4 text-warning" />
                  ) : scheduleVariance > 0 ? (
                    <ArrowUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${scheduleVariance < 0 ? "text-warning" : scheduleVariance > 0 ? "text-green-400" : "text-foreground"}`}>
                    {scheduleVariance >= 0 ? "+" : ""}${scheduleVariance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {scheduleVariance < 0 ? `Behind schedule${dateRange !== 'all_time' ? ` (${dateRange.replace('_', ' ')})` : ''}` : scheduleVariance > 0 ? `Ahead of schedule${dateRange !== 'all_time' ? ` (${dateRange.replace('_', ' ')})` : ''}` : "On schedule"}
                  </p>
                </CardContent>
              </Card>
                </TooltipTrigger>
                <TooltipContent>
                  Schedule Variance: EV - PV. (Positive = Ahead of Schedule).
                </TooltipContent>
              </UITooltip>

              {/* Cost Variance Widget */}
              <UITooltip>
                <TooltipTrigger asChild>
              <Card className={costVariance < 0 ? "border-destructive/50 bg-destructive/5" : costVariance > 0 ? "border-green-500/50 bg-green-500/5" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Cost Variance</CardTitle>
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Difference between Earned Value and Actual Cost</p>
                          <p className="text-xs mt-1">Positive = Under budget</p>
                          <p className="text-xs">Negative = Over budget</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
                  {costVariance < 0 ? (
                    <ArrowDown className="h-4 w-4 text-destructive" />
                  ) : costVariance > 0 ? (
                    <ArrowUp className="h-4 w-4 text-green-400" />
                  ) : (
                    <div className="h-4 w-4" />
                  )}
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${costVariance < 0 ? "text-destructive" : costVariance > 0 ? "text-green-400" : "text-foreground"}`}>
                    {costVariance >= 0 ? "+" : ""}${costVariance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {costVariance < 0 ? `Over budget${dateRange !== 'all_time' ? ` (${dateRange.replace('_', ' ')})` : ''}` : costVariance > 0 ? `Under budget${dateRange !== 'all_time' ? ` (${dateRange.replace('_', ' ')})` : ''}` : "On budget"}
                  </p>
                </CardContent>
              </Card>
                </TooltipTrigger>
                <TooltipContent>
                  Cost Variance: EV - AC. (Positive = Under Budget/Savings).
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Remaining</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${isOverBudget ? "text-warning" : "text-foreground"}`}>
                    ${remainingBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{budgetHealth.toFixed(1)}% remaining</p>
                </CardContent>
              </Card>
                </TooltipTrigger>
                <TooltipContent>
                  Funds Left: (Total Injected Funds) - (Actual Cost).
                </TooltipContent>
              </UITooltip>
            </div>

            {/* EVM S-Curve Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Earned Value Management - S-Curve</CardTitle>
                <CardDescription>Planned Value (PV), Actual Cost (AC), and Earned Value (EV) over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] bg-slate-950 rounded-lg p-4">
                  {chartLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                        <p className="text-sm text-muted-foreground">Loading chart data...</p>
                      </div>
                    </div>
                  ) : evmData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-sm text-muted-foreground">No EVM data available</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={evmData}>
                        <defs>
                          {/* Gradient for PV area */}
                          <linearGradient id="pvGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6b7280" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#6b7280" stopOpacity={0.05} />
                          </linearGradient>
                          {/* Gradient for AC area */}
                          <linearGradient id="acGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeWidth={1} strokeOpacity={0.3} />
                        <XAxis
                          dataKey="date"
                          stroke="#ffffff"
                          fontSize={12}
                          fontWeight={600}
                          tick={{ fill: "#ffffff" }}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          stroke="#ffffff"
                          fontSize={12}
                          fontWeight={600}
                          tick={{ fill: "#ffffff" }}
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
                            return [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, name]
                          }}
                          labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend wrapperStyle={{ color: "#ffffff" }} iconType="line" />
                        {/* PV Line - Dashed Gray/Blue (The Plan) */}
                        <Line
                          type="monotone"
                          dataKey="PV"
                          stroke="#6b7280"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: "#6b7280", r: 3 }}
                          name="Planned Value (PV)"
                        />
                        {/* AC Line - Solid Red/Orange (The Spend) */}
                        <Line
                          type="monotone"
                          dataKey="AC"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={{ fill: "#ef4444", r: 3 }}
                          name="Actual Cost (AC)"
                        />
                        {/* EV Line - Solid Bright Green (The Value) */}
                        <Line
                          type="monotone"
                          dataKey="EV"
                          stroke="#22c55e"
                          strokeWidth={3}
                          dot={{ fill: "#22c55e", r: 4 }}
                          name="Earned Value (EV)"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="flex items-center justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-gray-500 border-t-2 border-dashed" />
                    <span className="text-sm font-medium text-gray-400">PV (Planned)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-red-500" />
                    <span className="text-sm font-medium text-red-400">AC (Actual)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-green-500" />
                    <span className="text-sm font-medium text-green-400">EV (Earned)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Velocity Card - Only for managers */}
            {canViewFinancial && projectId && (
              <div className="mt-6">
                <VelocityCard projectId={projectId} period="week" />
              </div>
            )}
          </>
        )}
      </div>

      <ManageFundsModal 
        open={showManageFunds} 
        onOpenChange={setShowManageFunds}
        onTransactionCreated={handleTransactionCreated}
        projectId={projectId || undefined}
      />
      <BudgetBreakdownModal open={showBudgetBreakdown} onOpenChange={setShowBudgetBreakdown} />
      <TransactionLogDrawer 
        open={showTransactionLog} 
        onOpenChange={setShowTransactionLog} 
        projectId={projectId || ''}
        refreshTrigger={transactionRefreshTrigger}
      />
      {projectId && canViewFinancial && (
        <InvestorReportModal 
          open={showInvestorReport} 
          onOpenChange={setShowInvestorReport}
          projectId={projectId}
        />
      )}
    </div>
  )
}
