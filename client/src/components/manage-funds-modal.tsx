"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Minus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { financials as financialsAPI } from "@/services/api"
import { toast } from "sonner"
import { useParams } from "react-router-dom"

interface ManageFundsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTransactionCreated?: () => void
  projectId?: string
}

export function ManageFundsModal({ open, onOpenChange, onTransactionCreated, projectId: propProjectId }: ManageFundsModalProps) {
  const { projectId: urlProjectId } = useParams<{ projectId?: string }>()
  const projectId = propProjectId || urlProjectId
  
  const [type, setType] = useState<"income" | "expense">("income")
  const [amount, setAmount] = useState("")
  const [source, setSource] = useState("")
  const [reason, setReason] = useState("")
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    // Validation
    const amountNum = parseFloat(amount)
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount greater than 0")
      return
    }

    if (!source.trim()) {
      toast.error("Please enter a source/category")
      return
    }

    if (!reason.trim()) {
      toast.error("Please enter a reason/description")
      return
    }

    if (!projectId) {
      toast.error("Project ID is missing")
      return
    }

    setIsSubmitting(true)

    try {
      // Prepare payload
      const payload = {
        amount: amountNum,
        type: type === "income" ? "+" : "-",
        source: source.trim(),
        effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : new Date().toISOString(),
        description: reason.trim(),
      }

      // Make API call
      await financialsAPI.createTransaction(projectId, payload)

      // Success feedback
      toast.success(type === "income" ? "Funds added successfully" : "Expense logged successfully")

      // Notify parent to refetch data
      if (onTransactionCreated) {
        onTransactionCreated()
      }

      // Close modal and reset form
      onOpenChange(false)
      setAmount("")
      setSource("")
      setReason("")
      setType("income")
    } catch (error: any) {
      console.error("Failed to create transaction:", error)
      const errorMessage = error?.response?.data?.message || error?.message || "Failed to create transaction"
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
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

          {/* Effective Date (retroactive allowed) */}
          <div className="space-y-2">
            <Label htmlFor="effective-date">Effective Date</Label>
            <Input
              id="effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              You can log past transactions. Stored as the transaction's effective date.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!amount || !source || !reason || isSubmitting}
            className={type === "income" ? "bg-success hover:bg-success/90" : ""}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              type === "income" ? "Add Funds" : "Log Expense"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
