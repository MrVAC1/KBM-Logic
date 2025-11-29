"use client"

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react"
import { mockTransactions } from "@/lib/mock-data"

interface TransactionLogDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransactionLogDrawer({ open, onOpenChange }: TransactionLogDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Transaction Log</SheetTitle>
          <SheetDescription>Complete history of all project transactions</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {mockTransactions.map((transaction) => (
            <Card key={transaction.id}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {transaction.type === "income" ? (
                    <ArrowUpCircle className="h-5 w-5 text-success shrink-0 mt-0.5" />
                  ) : (
                    <ArrowDownCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium">{transaction.source}</p>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{transaction.reason}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-lg font-bold ${
                            transaction.type === "income" ? "text-success" : "text-destructive"
                          }`}
                        >
                          {transaction.type === "income" ? "+" : "-"}${transaction.amount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {transaction.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
