"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

interface Expense {
  _id?: string
  id?: string
  name: string
  amount: number
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  createdAt?: string
  updatedAt?: string
}

interface ExpenseModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense?: Expense | null
  onSuccess: (data?: { name: string; amount: number; frequency: string }) => void | Promise<void>
}

export function ExpenseModal({ open, onOpenChange, expense, onSuccess }: ExpenseModalProps) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (expense) {
      setName(expense.name || "")
      setAmount(expense.amount?.toString() || "")
      setFrequency(expense.frequency || 'monthly')
    } else {
      setName("")
      setAmount("")
      setFrequency('monthly')
    }
  }, [expense, open])

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Expense name is required")
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum < 0) {
      toast.error("Amount must be a valid non-negative number")
      return
    }

    setIsSubmitting(true)
    try {
      // Pass expense data to parent via onSuccess
      await onSuccess({ name: name.trim(), amount: amountNum, frequency })
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to save expense")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Create Expense"}</DialogTitle>
          <DialogDescription>
            {expense ? "Update expense details" : "Add a new project expense"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="expense-name">Expense Name *</Label>
            <Input
              id="expense-name"
              placeholder="e.g., Office supplies, Software license"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-amount">Amount ($) *</Label>
            <Input
              id="expense-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expense-frequency">Frequency *</Label>
            <Select value={frequency} onValueChange={(value: any) => setFrequency(value)}>
              <SelectTrigger id="expense-frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select how often this expense occurs. Default is monthly.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim() || !amount}>
            {isSubmitting ? "Saving..." : expense ? "Update" : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

