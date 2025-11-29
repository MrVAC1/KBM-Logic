"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

interface ManageFundsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ManageFundsModal({ open, onOpenChange }: ManageFundsModalProps) {
  const [type, setType] = useState<"income" | "expense">("income")
  const [amount, setAmount] = useState("")
  const [source, setSource] = useState("")
  const [reason, setReason] = useState("")

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const handleSubmit = () => {
    // Process transaction
    console.log({ type, amount, source, reason, date: today })
    onOpenChange(false)
    // Reset form
    setAmount("")
    setSource("")
    setReason("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Funds</DialogTitle>
          <DialogDescription>Add funds to the project or log an expense</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Type Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "income" ? "default" : "outline"}
              className={cn("flex-1", type === "income" && "bg-success hover:bg-success/90 text-success-foreground")}
              onClick={() => setType("income")}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Funds
            </Button>
            <Button
              type="button"
              variant={type === "expense" ? "default" : "outline"}
              className={cn("flex-1", type === "expense" && "bg-destructive hover:bg-destructive/90")}
              onClick={() => setType("expense")}
            >
              <Minus className="mr-2 h-4 w-4" />
              Log Expense
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">{type === "income" ? "Source" : "Category"} *</Label>
            <Input
              id="source"
              placeholder={type === "income" ? "e.g., Client Payment" : "e.g., Software Licenses"}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Describe the transaction..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {/* Date field - READ ONLY */}
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" value={today} disabled className="bg-muted text-muted-foreground cursor-not-allowed" />
            <p className="text-xs text-muted-foreground">Date is automatically set to today</p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || !source || !reason}
            className={type === "income" ? "bg-success hover:bg-success/90" : ""}
          >
            {type === "income" ? "Add Funds" : "Log Expense"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
