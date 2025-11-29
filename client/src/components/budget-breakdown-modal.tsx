"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { mockFixedCosts, mockTasks, mockTransactions } from "@/lib/mock-data"

interface BudgetBreakdownModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BudgetBreakdownModal({ open, onOpenChange }: BudgetBreakdownModalProps) {
  const totalFixedCosts = mockFixedCosts.reduce((sum, c) => sum + c.amount, 0) * 6 // 6 months
  const totalTaskCosts = mockTasks.reduce((sum, t) => sum + t.estimatedCost, 0)
  const totalPlanned = totalFixedCosts + totalTaskCosts

  const totalActualExpenses = mockTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Budget Breakdown</DialogTitle>
          <DialogDescription>Detailed view of planned items vs actual expenses</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="planned" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="planned">Planned Items</TabsTrigger>
            <TabsTrigger value="actual">Actual Expenses</TabsTrigger>
          </TabsList>

          <TabsContent value="planned" className="space-y-4 max-h-[500px] overflow-y-auto">
            {/* Fixed Costs */}
            <div>
              <h3 className="mb-3 text-lg font-semibold">Fixed Costs (6 months)</h3>
              <div className="space-y-2">
                {mockFixedCosts.map((cost) => (
                  <Card key={cost.id}>
                    <CardContent className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{cost.name}</p>
                        <p className="text-sm text-muted-foreground">{cost.category}</p>
                      </div>
                      <p className="font-bold">${(cost.amount * 6).toLocaleString()}</p>
                    </CardContent>
                  </Card>
                ))}
                <Card className="border-primary/50">
                  <CardContent className="flex items-center justify-between py-3">
                    <p className="font-semibold">Fixed Costs Subtotal</p>
                    <p className="text-lg font-bold text-primary">${totalFixedCosts.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Tasks */}
            <div>
              <h3 className="mb-3 text-lg font-semibold">Task Estimates</h3>
              <div className="space-y-2">
                {mockTasks.map((task) => (
                  <Card key={task.id}>
                    <CardContent className="flex items-center justify-between py-3">
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.complexity.charAt(0).toUpperCase() + task.complexity.slice(1)} Complexity
                        </p>
                      </div>
                      <p className="font-bold">${task.estimatedCost.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                ))}
                <Card className="border-primary/50">
                  <CardContent className="flex items-center justify-between py-3">
                    <p className="font-semibold">Tasks Subtotal</p>
                    <p className="text-lg font-bold text-primary">${totalTaskCosts.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Total Planned */}
            <Card className="border-2 border-primary">
              <CardContent className="flex items-center justify-between py-4">
                <p className="text-lg font-bold">Total Planned Budget</p>
                <p className="text-2xl font-bold text-primary">${totalPlanned.toLocaleString()}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actual" className="space-y-4 max-h-[500px] overflow-y-auto">
            <div className="space-y-2">
              {mockTransactions
                .filter((t) => t.type === "expense")
                .map((transaction) => (
                  <Card key={transaction.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">{transaction.source}</p>
                          <p className="text-sm text-muted-foreground mt-1">{transaction.reason}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(transaction.date).toLocaleDateString()}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-destructive">-${transaction.amount.toLocaleString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>

            <Card className="border-2 border-destructive">
              <CardContent className="flex items-center justify-between py-4">
                <p className="text-lg font-bold">Total Actual Expenses</p>
                <p className="text-2xl font-bold text-destructive">${totalActualExpenses.toLocaleString()}</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
