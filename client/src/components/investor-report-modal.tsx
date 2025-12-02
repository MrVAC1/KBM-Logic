"use client"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Battery, BatteryLow, BatteryMedium, BatteryFull, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Users, X } from "lucide-react"
import { reports as reportsAPI } from "@/services/api"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { toast } from "sonner"

// Custom scrollbar styles for dark theme
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgb(63 63 70);
    border-radius: 9999px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgb(82 82 91);
  }
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgb(63 63 70) transparent;
  }
`

interface InvestorReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

interface InvestorReportData {
  project: {
    id: string
    name: string
    description: string
    startDate: string
    currentDate: string
  }
  burnRate: {
    monthly: number
    daily: number
  }
  runway: {
    months: number | null
    date: string | null
    status: 'healthy' | 'warning' | 'critical' | 'infinite'
    message: string
  }
  financials: {
    plannedTotal: number
    actualTotal: number
    variance: number
  }
  topRisks: Array<{
    taskId: string
    title: string
    riskScore: number
    probability: number
    impact: number
    description: string
    status: string
  }>
  roadmapStatus: {
    completedTasks: number
    totalTasks: number
    completedPercentage: number
    timeElapsedPercentage: number
    isAheadOfSchedule: boolean
  }
  team: {
    roleDistribution: Record<string, number>
    members: Array<{
      userId: string
      displayName: string
      email: string
      roles: string[]
      primaryRole: string
      monthlySalary: number
      hourlyRate: number
      dailyRate: number
      joinedAt: string
    }>
    totalMembers: number
    totalMonthlySalary: number
  } | null
  isOwner: boolean
}

export function InvestorReportModal({ 
  open, 
  onOpenChange, 
  projectId 
}: InvestorReportModalProps) {
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<InvestorReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const reportContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && projectId) {
      fetchReportData()
    }
  }, [open, projectId])

  // Inject custom scrollbar styles
  useEffect(() => {
    const styleElement = document.createElement('style')
    styleElement.textContent = scrollbarStyles
    document.head.appendChild(styleElement)
    
    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  const fetchReportData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await reportsAPI.getInvestorReport(projectId)
      const data = response.data?.data || response.data
      setReportData(data)
    } catch (err) {
      console.error('Failed to fetch investor report:', err)
      setError('Failed to load investor report')
      toast.error('Failed to load investor report')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    // Validate prerequisites
    if (!reportContentRef.current) {
      console.error('PDF Generation Error: reportContentRef.current is null')
      toast.error('Report content element not found')
      return
    }

    if (!reportData) {
      console.error('PDF Generation Error: reportData is null')
      toast.error('Report data not available')
      return
    }

    // Check if element is rendered
    if (!reportContentRef.current.offsetParent && reportContentRef.current.offsetWidth === 0) {
      console.error('PDF Generation Error: Report content element is not visible')
      toast.error('Report content is not visible. Please ensure the modal is fully open.')
      return
    }

    setIsGeneratingPDF(true)
    toast.info('Generating PDF...')

    try {
      console.log('Starting PDF generation...', {
        elementExists: !!reportContentRef.current,
        elementId: reportContentRef.current.id,
        scrollWidth: reportContentRef.current.scrollWidth,
        scrollHeight: reportContentRef.current.scrollHeight,
      })

      // Get the original container element
      const originalElement = reportContentRef.current

      // Capture the report content as canvas with high quality
      const canvas = await html2canvas(originalElement, {
        scale: 2,
        useCORS: true,
        logging: true,
        backgroundColor: '#09090b', // Force HEX background (dark theme) to avoid oklch issues
        windowWidth: originalElement.scrollWidth,
        windowHeight: originalElement.scrollHeight,
        allowTaint: true,
        onclone: (clonedDoc, element) => {
          // Get the cloned container element
          const clonedElement = clonedDoc.getElementById('report-printable-area')
          
          if (!clonedElement) {
            console.warn('Cloned element not found in onclone callback')
            return
          }

          // Force the main container background to HEX explicitly
          clonedElement.style.backgroundColor = '#09090b'
          clonedElement.style.color = '#ffffff'

          // Get all elements from both original and cloned DOM
          const originalElements = originalElement.querySelectorAll('*')
          const clonedElements = clonedElement.querySelectorAll('*')

          console.log(`Transferring computed styles: ${originalElements.length} elements`)

          // Transfer computed styles from original to clone
          // The browser has already converted oklch/CSS variables to RGB in computed styles
          originalElements.forEach((originalEl, index) => {
            if (!(originalEl instanceof HTMLElement)) return
            
            const clonedEl = clonedElements[index]
            if (!(clonedEl instanceof HTMLElement)) return

            // Get computed styles from the original element (browser has converted to RGB)
            const computed = window.getComputedStyle(originalEl)

            // Force-apply RGB values to the clone (bypasses stylesheet parsing)
            if (computed.backgroundColor && computed.backgroundColor !== 'rgba(0, 0, 0, 0)') {
              clonedEl.style.backgroundColor = computed.backgroundColor
            }
            
            if (computed.color) {
              clonedEl.style.color = computed.color
            }
            
            if (computed.borderColor && computed.borderColor !== 'rgba(0, 0, 0, 0)') {
              clonedEl.style.borderColor = computed.borderColor
            }

            // Also transfer border width and style if present
            if (computed.borderWidth && computed.borderWidth !== '0px') {
              clonedEl.style.borderWidth = computed.borderWidth
              clonedEl.style.borderStyle = computed.borderStyle || 'solid'
            }

            // Transfer other important visual properties
            if (computed.opacity && computed.opacity !== '1') {
              clonedEl.style.opacity = computed.opacity
            }
          })

          // Also handle the root container element itself
          const originalComputed = window.getComputedStyle(originalElement)
          clonedElement.style.backgroundColor = originalComputed.backgroundColor || '#09090b'
          clonedElement.style.color = originalComputed.color || '#ffffff'

          console.log('Computed styles transferred successfully')
        },
      })

      console.log('Canvas created:', {
        width: canvas.width,
        height: canvas.height,
      })

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas creation failed: invalid dimensions')
      }

      const imgData = canvas.toDataURL('image/png', 1.0)
      
      if (!imgData || imgData === 'data:,') {
        throw new Error('Failed to convert canvas to image data')
      }

      console.log('Image data generated, length:', imgData.length)
      
      // Calculate PDF dimensions (A4 size in mm)
      const pdfWidth = 210 // A4 width in mm
      const pdfHeight = 297 // A4 height in mm
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      
      // Convert pixels to mm (1px = 0.264583mm at 96 DPI)
      const pxToMm = 0.264583
      const imgWidthMm = imgWidth * pxToMm
      const imgHeightMm = imgHeight * pxToMm
      
      // Calculate scaling to fit A4 while maintaining aspect ratio
      const widthRatio = pdfWidth / imgWidthMm
      const heightRatio = pdfHeight / imgHeightMm
      const ratio = Math.min(widthRatio, heightRatio)
      
      const finalWidth = imgWidthMm * ratio
      const finalHeight = imgHeightMm * ratio

      // Create PDF in portrait mode
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      })

      // Center image on page
      const xOffset = (pdfWidth - finalWidth) / 2
      const yOffset = 0

      // Add image to PDF
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight)
      
      // If content is taller than one page, add additional pages
      if (finalHeight > pdfHeight) {
        let heightLeft = finalHeight - pdfHeight
        let position = -pdfHeight
        
        while (heightLeft > 0) {
          pdf.addPage()
          position -= pdfHeight
          pdf.addImage(imgData, 'PNG', xOffset, position, finalWidth, finalHeight)
          heightLeft -= pdfHeight
        }
      }

      // Generate filename with date
      const dateStr = new Date().toISOString().split('T')[0]
      const sanitizedName = reportData.project.name.replace(/[^a-zA-Z0-9_-]/g, '_')
      const filename = `Project_Report_${sanitizedName}_${dateStr}.pdf`

      // Save PDF
      pdf.save(filename)
      
      console.log('PDF generated successfully')
      toast.success('PDF generated successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error('PDF generation error:', {
        message: errorMessage,
        error,
      })
      
      toast.error(`Failed to generate PDF: ${errorMessage}`)
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const getBatteryIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <BatteryFull className="h-8 w-8 text-green-500" />
      case 'warning':
        return <BatteryMedium className="h-8 w-8 text-yellow-500" />
      case 'critical':
        return <BatteryLow className="h-8 w-8 text-red-500" />
      case 'infinite':
        return <BatteryFull className="h-8 w-8 text-green-500" />
      default:
        return <Battery className="h-8 w-8 text-muted-foreground" />
    }
  }

  const getBatteryColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500'
      case 'warning':
        return 'bg-yellow-500'
      case 'critical':
        return 'bg-red-500'
      case 'infinite':
        return 'bg-green-500'
      default:
        return 'bg-muted'
    }
  }

  // Generate timeline data for chart (last 6 months)
  const generateTimelineData = () => {
    if (!reportData?.financials || !reportData?.project) {
      return []
    }
    
    const data = []
    const today = new Date(reportData.project?.currentDate || new Date())
    const startDate = new Date(reportData.project?.startDate || new Date())
    
    // Generate monthly data points
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today)
      date.setMonth(date.getMonth() - i)
      
      if (date >= startDate) {
        // Calculate approximate values for each month
        const monthsSinceStart = (date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
        const plannedTotal = reportData.financials?.plannedTotal ?? 0
        const actualTotal = reportData.financials?.actualTotal ?? 0
        const plannedValue = Math.min(
          plannedTotal,
          (plannedTotal * monthsSinceStart) / 6
        )
        const actualValue = Math.min(
          actualTotal,
          (actualTotal * monthsSinceStart) / 6
        )
        
        data.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          planned: Math.max(0, plannedValue),
          actual: Math.max(0, actualValue),
        })
      }
    }
    
    // Ensure at least 2 data points for visible chart
    if (data.length === 0) {
      // No data points generated, create start and current
      return [
        { month: 'Start', planned: 0, actual: 0 },
        { month: 'Current', planned: reportData.financials?.plannedTotal ?? 0, actual: reportData.financials?.actualTotal ?? 0 },
      ]
    } else if (data.length === 1) {
      // Only one data point, add a start point at 0
      const currentPoint = data[0]
      return [
        { month: 'Start', planned: 0, actual: 0 },
        currentPoint,
      ]
    }
    
    return data
  }

  const timelineData = generateTimelineData()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[90vw] !max-w-[1400px] !sm:max-w-[1400px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="w-full flex-shrink-0 px-6 pr-[22px] pt-6 pb-4 border-b">
          <div className="flex items-center justify-between w-full gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-left">Investor Report</DialogTitle>
              <DialogDescription className="text-left">
                Comprehensive financial and progress overview
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {reportData && (
                <Button 
                  onClick={handleDownloadPDF} 
                  className="gap-2"
                  disabled={isGeneratingPDF}
                >
                  <Download className="h-4 w-4" />
                  {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div 
          className="flex-1 overflow-y-auto px-6 custom-scrollbar" 
          style={{ scrollbarGutter: 'stable' }}
        >
          {loading ? (
            <div className="space-y-4 py-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
            </div>
          ) : reportData ? (
            <div 
              id="report-printable-area"
              ref={reportContentRef} 
              className="space-y-6 bg-background py-6"
            >
              {/* Header */}
              <div className="border-b pb-4">
                <h1 className="text-3xl font-bold">{reportData.project.name}</h1>
                <p className="text-muted-foreground mt-1">{reportData.project.description}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Report Generated: {new Date(reportData.project?.currentDate || new Date()).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
                {/* Burn Rate */}
                <Card className="w-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Burn Rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">${(reportData.burnRate?.monthly ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                    <p className="text-xs text-muted-foreground mt-1">per month</p>
                    <p className="text-xs text-muted-foreground">${(reportData.burnRate?.daily ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} per day</p>
                  </CardContent>
                </Card>

                {/* Runway */}
                <Card className="w-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      Runway
                      {getBatteryIcon(reportData.runway?.status ?? 'critical')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {reportData.runway?.status === 'infinite' ? (
                      <>
                        <div className="text-3xl font-bold text-green-500">Infinite</div>
                        <p className="text-xs text-muted-foreground mt-1">No burn rate detected</p>
                      </>
                    ) : (
                      <>
                        <div className="text-3xl font-bold">
                          {(reportData.runway?.months !== null && reportData.runway?.months !== undefined && reportData.runway.months < 1 && reportData.runway.months > 0)
                            ? '< 1'
                            : (reportData.runway?.months?.toFixed(1) ?? '0.0')
                          }
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">months remaining</p>
                        <p className="text-xs text-muted-foreground">{reportData.runway?.message ?? 'Calculating...'}</p>
                        {/* Battery Visual */}
                        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${getBatteryColor(reportData.runway?.status ?? 'critical')} transition-all`}
                            style={{ 
                              width: `${Math.min(100, Math.max(0, (reportData.runway.months || 0) / 12 * 100))}%` 
                            }}
                          />
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Financial Variance */}
                <Card className="w-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Budget Variance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-3xl font-bold ${(reportData.financials?.variance ?? 0) >= 0 ? 'text-destructive' : 'text-green-500'}`}>
                      {(reportData.financials?.variance ?? 0) >= 0 ? '+' : ''}${Math.abs(reportData.financials?.variance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(reportData.financials?.variance ?? 0) >= 0 ? 'Over budget' : 'Under budget'}
                    </p>
                    <div className="flex items-center gap-1 mt-2">
                      {(reportData.financials?.variance ?? 0) >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-destructive" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-green-500" />
                      )}
                      {(reportData.financials?.plannedTotal ?? 0) > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {(Math.abs((reportData.financials?.variance ?? 0) / (reportData.financials?.plannedTotal ?? 1)) * 100).toFixed(1)}%
                        </span>
                      ) : (reportData.financials?.actualTotal ?? 0) > 0 ? (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">0.0%</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Financials Chart */}
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Financial Overview</CardTitle>
                </CardHeader>
                <CardContent className="w-full">
                  <div className="h-64 pr-4 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart 
                        data={timelineData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="month" 
                          stroke="hsl(var(--foreground))"
                          tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
                        />
                        <YAxis 
                          stroke="hsl(var(--foreground))"
                          tick={{ fill: 'hsl(var(--foreground))' }}
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          domain={['auto', 'auto']}
                          allowDataOverflow={false}
                        />
                        <Tooltip
                          formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="planned"
                          stroke="#3b82f6"
                          fill="#3b82f6"
                          fillOpacity={0.3}
                          name="Planned"
                        />
                        <Area
                          type="monotone"
                          dataKey="actual"
                          stroke="#ef4444"
                          fill="#ef4444"
                          fillOpacity={0.3}
                          name="Actual"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Planned Total</p>
                      <p className="text-2xl font-bold mt-1">${(reportData.financials?.plannedTotal ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground">Actual Total</p>
                      <p className="text-2xl font-bold mt-1">${(reportData.financials?.actualTotal ?? 0).toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Roadmap Status */}
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Roadmap Progress
                    {reportData.roadmapStatus.isAheadOfSchedule ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="w-full">
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Tasks Completed</span>
                        <span className="font-semibold">
                          {reportData.roadmapStatus.completedTasks} / {reportData.roadmapStatus.totalTasks} 
                          ({reportData.roadmapStatus.completedPercentage.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={reportData.roadmapStatus.completedPercentage} className="h-3" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Time Elapsed</span>
                        <span className="font-semibold">{reportData.roadmapStatus.timeElapsedPercentage.toFixed(1)}%</span>
                      </div>
                      <Progress value={reportData.roadmapStatus.timeElapsedPercentage} className="h-3" />
                    </div>
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium">
                        {reportData.roadmapStatus.isAheadOfSchedule ? (
                          <span className="text-green-500">
                            ✓ Ahead of Schedule: {((reportData.roadmapStatus.completedPercentage - reportData.roadmapStatus.timeElapsedPercentage)).toFixed(1)}% ahead
                          </span>
                        ) : (
                          <span className="text-warning">
                            ⚠ Behind Schedule: {((reportData.roadmapStatus.timeElapsedPercentage - reportData.roadmapStatus.completedPercentage)).toFixed(1)}% behind
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Risks */}
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    Top Risks
                  </CardTitle>
                </CardHeader>
                <CardContent className="w-full">
                  {reportData.topRisks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No risks identified</p>
                  ) : (
                    <div className="space-y-3">
                      {reportData.topRisks.map((risk, index) => (
                        <div key={risk.taskId} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="destructive">Risk #{index + 1}</Badge>
                                <Badge variant="outline">Score: {risk.riskScore}</Badge>
                                <Badge variant="secondary">{risk.status}</Badge>
                              </div>
                              <h4 className="font-semibold mb-1">{risk.title}</h4>
                              {risk.description && (
                                <p className="text-sm text-muted-foreground mb-2">{risk.description}</p>
                              )}
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>Probability: {risk.probability}/5</span>
                                <span>Impact: {risk.impact}/5</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Human Capital & Burn Rate - Only for Owner */}
              {reportData.isOwner && reportData.team && (
                <Card className="w-full">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Team & Financial Structure
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="w-full">
                    <div className="space-y-6">
                      {/* Role Distribution */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Role Distribution</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {Object.entries(reportData.team.roleDistribution).map(([role, count]) => (
                            <div key={role} className="p-3 border rounded-lg text-center">
                              <p className="text-2xl font-bold">{count}</p>
                              <p className="text-sm text-muted-foreground">{role}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Team Members Table */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">Project Members</h3>
                        {reportData.team.members.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">No team members</p>
                        ) : (
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Member</TableHead>
                                  <TableHead>Role(s)</TableHead>
                                  {reportData.isOwner && (
                                    <>
                                      <TableHead className="text-right">Monthly Salary</TableHead>
                                      <TableHead className="text-right">Hourly Rate</TableHead>
                                      <TableHead className="text-right">Daily Rate</TableHead>
                                    </>
                                  )}
                                  <TableHead>Joined</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reportData.team.members.map((member) => (
                                  <TableRow key={member.userId}>
                                    <TableCell className="font-medium">
                                      <div>
                                        <p>{member.displayName}</p>
                                        <p className="text-xs text-muted-foreground">{member.email}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex flex-wrap gap-1">
                                        {member.roles.map((role, idx) => (
                                          <Badge key={idx} variant="secondary" className="text-xs">
                                            {role}
                                          </Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                    {reportData.isOwner && (
                                      <>
                                        <TableCell className="text-right font-semibold">
                                          ${member.monthlySalary > 0 ? member.monthlySalary.toLocaleString(undefined, { maximumFractionDigits: 0 }) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          ${member.hourlyRate > 0 ? member.hourlyRate.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          ${member.dailyRate > 0 ? member.dailyRate.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'N/A'}
                                        </TableCell>
                                      </>
                                    )}
                                    <TableCell className="text-sm text-muted-foreground">
                                      {new Date(member.joinedAt).toLocaleDateString('en-US', { 
                                        year: 'numeric', 
                                        month: 'short', 
                                        day: 'numeric' 
                                      })}
                                    </TableCell>
                                  </TableRow>
                                ))}
                                {reportData.isOwner && (
                                  <TableRow className="bg-muted/50 font-semibold">
                                    <TableCell colSpan={2} className="text-right">Total Team Salary:</TableCell>
                                    <TableCell className="text-right">
                                      ${reportData.team.totalMonthlySalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </TableCell>
                                    <TableCell colSpan={3}></TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>

                      {/* Summary */}
                      {reportData.isOwner && (
                        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Total Team Members</p>
                              <p className="text-2xl font-bold">{reportData.team.totalMembers}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-muted-foreground">Total Monthly Salary Cost</p>
                              <p className="text-2xl font-bold text-primary">
                                ${reportData.team.totalMonthlySalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
