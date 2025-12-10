"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react"
import { financials as transactionsAPI } from "@/services/api"
import { toast } from "sonner"

interface TransactionLogDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
}

interface Transaction {
  _id: string
  amount: number
  type: '+' | '-'
  source: string
  date: string
  effectiveDate?: string
  createdAt?: string
  description?: string
  authorId?: {
    _id: string
    displayName?: string
    email?: string
  }
}

export function TransactionLogDrawer({ open, onOpenChange, projectId, refreshTrigger }: TransactionLogDrawerProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTransactions = async () => {
    if (!projectId) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await transactionsAPI.getTransactions(projectId)
      const data = response.data?.data || response.data || []
      setTransactions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
      setError('Failed to load transactions')
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && projectId) {
      fetchTransactions()
    }
  }, [open, projectId, refreshTrigger])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Transaction Log</SheetTitle>
          <SheetDescription>Complete history of all project transactions</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="py-4">
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No transactions found</p>
            </div>
          ) : (
            transactions.map((transaction) => {
              const isIncome = transaction.type === '+'
              const authorName = transaction.authorId?.displayName || transaction.authorId?.email?.split('@')[0] || 'Unknown'
              
              return (
                <Card key={transaction._id}>
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      {isIncome ? (
                        <ArrowUpCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <ArrowDownCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-medium">{transaction.source}</p>
                            {transaction.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{transaction.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">By: {authorName}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`text-lg font-bold ${
                                isIncome ? "text-green-500" : "text-red-500"
                              }`}
                            >
                              {isIncome ? "+" : "-"}${transaction.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {isIncome ? "Income" : "Expense"}
                          </Badge>
                          {transaction.createdAt && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-muted-foreground">Created At:</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(transaction.createdAt).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                          {transaction.effectiveDate && (
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-medium text-muted-foreground">Effective Date:</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(transaction.effectiveDate).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                          )}
                          {!transaction.createdAt && !transaction.effectiveDate && transaction.date && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(transaction.date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
