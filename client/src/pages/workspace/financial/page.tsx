import { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TrendingUp, TrendingDown, DollarSign, Calendar, ArrowUp, ArrowDown, Info, Target } from "lucide-react"
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
  const [dateRange, setDateRange] = useState<DateRangeType>('all_time')
  
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

  // Format EVM data for chart with "carry forward" logic to prevent zero-dropouts
  const evmData = useMemo(() => {
    if (!stats?.evmDataPoints || stats.evmDataPoints.length === 0) {
      return []
    }

    // Get current values from summary stats as fallback
    const currentACFromStats = stats?.current?.AC ?? null;
    const currentEVFromStats = stats?.current?.EV ?? null;

    // Sort by date to ensure chronological order
    const sortedPoints = [...stats.evmDataPoints].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });

    // Carry forward logic: track last known values for AC and EV
    // This prevents lines from dropping to 0 when a snapshot is missing for the current date
    let lastAC: number | null = null;
    let lastEV: number | null = null;

    let processedPoints = sortedPoints.map((point: any, index: number) => {
      // Check if this is the last point
      const isLastPoint = index === sortedPoints.length - 1;
      const originalDateStr = point.date; // Keep original ISO date string (YYYY-MM-DD)
      const pointDate = new Date(originalDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isToday = pointDate.getTime() === today.getTime();
      // PV is always available (can be 0 if no tasks)
      const pv = point.PV || 0;
      
      // AC: Use point value if valid, otherwise carry forward last known value
      let ac: number;
      const acValue = point.AC;
      const hasValidAC = acValue !== null && acValue !== undefined && !isNaN(acValue);
      
      if (hasValidAC && acValue > 0) {
        // Valid positive AC value - use it and update last known
        ac = acValue;
        lastAC = ac;
      } else if (hasValidAC && acValue === 0 && lastAC !== null && lastAC > 0) {
        // AC is 0 but we had a previous positive value - carry forward (prevent drop to 0)
        ac = lastAC;
      } else if (lastAC !== null && lastAC > 0) {
        // Missing/null/undefined AC but we have a previous positive value - carry forward
        ac = lastAC;
      } else if (hasValidAC) {
        // Valid AC value (including 0) but no previous value - use it
        ac = acValue;
        if (ac > 0) {
          lastAC = ac;
        }
      } else {
        // No valid value - check if this is today and we have summary stats
        if (isToday && currentACFromStats !== null && currentACFromStats > 0) {
          // Use summary stats value for today as fallback
          ac = currentACFromStats;
          lastAC = ac;
        } else if (lastAC !== null && lastAC > 0) {
          // Carry forward if we have a previous value
          ac = lastAC;
        } else {
          // No previous value and no fallback - use 0
          ac = 0;
        }
      }
      
      // EV: Use point value if valid, otherwise carry forward last known value
      let ev: number;
      const evValue = point.EV;
      const hasValidEV = evValue !== null && evValue !== undefined && !isNaN(evValue);
      
      if (hasValidEV && evValue > 0) {
        // Valid positive EV value - use it and update last known
        ev = evValue;
        lastEV = ev;
      } else if (hasValidEV && evValue === 0 && lastEV !== null && lastEV > 0) {
        // EV is 0 but we had a previous positive value - carry forward (prevent drop to 0)
        ev = lastEV;
      } else if (lastEV !== null && lastEV > 0) {
        // Missing/null/undefined EV but we have a previous positive value - carry forward
        ev = lastEV;
      } else if (hasValidEV) {
        // Valid EV value (including 0) but no previous value - use it
        ev = evValue;
        if (ev > 0) {
          lastEV = ev;
        }
      } else {
        // No valid value - check if this is today and we have summary stats
        if (isToday && currentEVFromStats !== null && currentEVFromStats > 0) {
          // Use summary stats value for today as fallback
          ev = currentEVFromStats;
          lastEV = ev;
        } else if (lastEV !== null && lastEV > 0) {
          // Carry forward if we have a previous value
          ev = lastEV;
        } else {
          // No previous value and no fallback - use 0
          ev = 0;
        }
      }

      return {
        date: new Date(originalDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        originalDate: originalDateStr, // Keep original ISO date string (YYYY-MM-DD) for comparison
        PV: pv,
        AC: ac,
        EV: ev,
      };
    });

    // Final pass: If the last point(s) have EV/AC = 0 but summary stats show positive values,
    // use summary stats as the authoritative source for recent points
    if (processedPoints.length > 0 && (currentACFromStats !== null || currentEVFromStats !== null)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check the last 3 points (to handle cases where today might not be the exact last point)
      const recentPoints = processedPoints.slice(-3);
      
      for (const point of recentPoints) {
        try {
          // Use originalDate (ISO string YYYY-MM-DD) for accurate date comparison
          if (point.originalDate) {
            const pointDate = new Date(point.originalDate);
            pointDate.setHours(0, 0, 0, 0);
            const daysDiff = Math.abs((pointDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            
            // If point is within 7 days of today and has 0 value, use summary stats
            if (daysDiff <= 7) {
              // Use summary stats as fallback if chart data shows 0 but stats show positive
              if (point.AC === 0 && currentACFromStats !== null && currentACFromStats > 0) {
                point.AC = currentACFromStats;
              }
              if (point.EV === 0 && currentEVFromStats !== null && currentEVFromStats > 0) {
                point.EV = currentEVFromStats;
              }
            }
          }
        } catch (error) {
          // Skip if date parsing fails
          continue;
        }
      }
    }

    return processedPoints;
  }, [stats])

  // Get current values with safety checks
  const currentPV = stats?.current?.PV ?? 0
  const currentAC = stats?.current?.AC ?? 0
  const currentEV = stats?.current?.EV ?? 0

  // Calculate variances with fallback
  const scheduleVariance = stats?.variances?.scheduleVariance ?? (currentEV - currentPV)
  const costVariance = stats?.variances?.costVariance ?? (currentEV - currentAC)

  // BAC (Budget at Completion) - Total planned value of ALL tasks
  const bac = stats?.budget?.bac ?? 0
  
  // Remaining Work Budget = BAC - AC (how much budget is left for the work)
  const remainingWorkBudget = stats?.budget?.remainingWork ?? Math.max(0, bac - currentAC)
  
  // Project Funds (Cash) - Income minus Expenses
  const projectFunds = stats?.funds?.available ?? 0
  
  // Funds Remaining (Cash Runway) = Funds - AC
  const fundsRemaining = Math.max(0, projectFunds - currentAC)
  
  // Budget calculation (includes income transactions) - Legacy for PV card
  const totalAdditionalFunds = stats?.budget?.totalAdditionalFunds ?? stats?.totalAdditionalFunds ?? 0
  const totalBudget = stats?.budget?.baseline 
    ? (stats.budget.baseline + totalAdditionalFunds)
    : (currentPV + totalAdditionalFunds)
  const actualSpent = currentAC || 0
  
  // Budget health calculation (percentage of BAC remaining)
  const budgetHealth = bac > 0 
    ? (remainingWorkBudget / bac) * 100 
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
            <div className="grid gap-6 md:grid-cols-4 lg:grid-cols-7 mb-8">
              {/* Budget at Completion (BAC) */}
              <UITooltip>
                <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Budget at Completion (BAC)</CardTitle>
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Total Budget at Completion. The sum of estimates for all tasks in the project.</p>
                          <p className="text-xs mt-1">Your 'Cost Baseline' - the total planned value regardless of time.</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">${bac.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total project budget
                  </p>
                  {bac > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Remaining Work: ${remainingWorkBudget.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </p>
                  )}
                </CardContent>
              </Card>
                </TooltipTrigger>
                <TooltipContent>
                  Budget at Completion: Total planned value of all tasks (your cost baseline).
                </TooltipContent>
              </UITooltip>

              <UITooltip>
                <TooltipTrigger asChild>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Planned Value (PV)</CardTitle>
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>The estimated cost of work scheduled to be done by now.</p>
                          <p className="text-xs mt-1">Calculated based on: (Task Working Hours × Role Hourly Rate)</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">${currentPV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
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
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Actual Cost (AC)</CardTitle>
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Total money spent up to this point.</p>
                          <p className="text-xs mt-1">Includes: (Daily Role Salaries accrued on working days) + (Fixed Costs & Expenses)</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
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
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Earned Value (EV)</CardTitle>
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>The real value of work actually completed.</p>
                          <p className="text-xs mt-1">Calculated as: (Task Budget × % Completion)</p>
                          <p className="text-xs">If you finished 50% of a $100 task, EV is $50</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
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
                          <p>Difference between EV and PV.</p>
                          <p className="text-xs mt-1">Positive (+) = Ahead of Schedule</p>
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
                          <p>Difference between EV and AC.</p>
                          <p className="text-xs mt-1">Positive (+) = Under Budget (Savings)</p>
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
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Funds Remaining</CardTitle>
                    <TooltipProvider>
                      <UITooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Cash Runway. The real money left on the project accounts.</p>
                          <p className="text-xs mt-1">Calculated as: (Total Income) - (Total Expenses) - (Actual Cost)</p>
                          <p className="text-xs mt-1">This is your available cash, not your work budget.</p>
                        </TooltipContent>
                      </UITooltip>
                    </TooltipProvider>
                  </div>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${fundsRemaining < 0 ? "text-destructive" : "text-foreground"}`}>
                    ${fundsRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {projectFunds > 0 ? ((fundsRemaining / projectFunds) * 100).toFixed(1) : '0'}% of funds
                  </p>
                </CardContent>
              </Card>
                </TooltipTrigger>
                <TooltipContent>
                  Funds Remaining: Available cash (Income - Expenses - Actual Cost).
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
                        {/* PV Area - Gray background (The Plan) */}
                        <Area
                          type="monotone"
                          dataKey="PV"
                          fill="url(#pvGradient)"
                          stroke="#9CA3AF"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          name="Planned Value (PV)"
                          dot={false}
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
