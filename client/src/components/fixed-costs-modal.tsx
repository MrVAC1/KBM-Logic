"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Trash2 } from "lucide-react"
import { mockFixedCosts, mockCurrentUser } from "@/lib/mock-data"

interface FixedCostsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FixedCostsModal({ open, onOpenChange }: FixedCostsModalProps) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("")

  const isOwner = mockCurrentUser.permissions.includes("edit_budget")

  const handleAdd = () => {
    console.log({ name, amount, category })
    setName("")
    setAmount("")
    setCategory("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Fixed Costs (Owner Only)</DialogTitle>
          <DialogDescription>Manage recurring monthly costs that feed into the planned baseline</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {/* Existing Fixed Costs */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Current Fixed Costs</h4>
            {mockFixedCosts.map((cost) => (
              <Card key={cost.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex-1">
                    <p className="font-medium">{cost.name}</p>
                    <p className="text-sm text-muted-foreground">{cost.category}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-lg font-bold">${cost.amount.toLocaleString()}/mo</p>
                    {isOwner && (
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add New Fixed Cost */}
          {isOwner && (
            <div className="space-y-4 border-t border-border pt-4">
              <h4 className="text-sm font-medium">Add New Fixed Cost</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cost-name">Name</Label>
                  <Input
                    id="cost-name"
                    placeholder="e.g., Senior Developer Salary"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost-amount">Monthly Amount</Label>
                  <Input
                    id="cost-amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="cost-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Salaries">Salaries</SelectItem>
                    <SelectItem value="Facilities">Facilities</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={!name || !amount || !category} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Fixed Cost
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-border pt-4">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
