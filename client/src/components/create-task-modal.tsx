"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { mockUsers, mockDepartments } from "@/lib/mock-data"

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTaskModal({ open, onOpenChange }: CreateTaskModalProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [complexity, setComplexity] = useState<"low" | "medium" | "high">("low")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [selectedDepartment, setSelectedDepartment] = useState<string>("")
  const [everyoneCanClaim, setEveryoneCanClaim] = useState(false)
  const [deadline, setDeadline] = useState<Date>()
  const [estimatedCost, setEstimatedCost] = useState("")

  const canSelectMultipleUsers = complexity === "medium" || complexity === "high"
  const canSelectDepartment = complexity === "high"

  const handleComplexityChange = (value: "low" | "medium" | "high") => {
    setComplexity(value)
    // Reset assignments based on complexity
    if (value === "low") {
      setSelectedUsers(selectedUsers.slice(0, 1))
      setSelectedDepartment("")
    } else if (value === "medium") {
      setSelectedDepartment("")
    }
  }

  const toggleUser = (userId: string) => {
    if (complexity === "low") {
      setSelectedUsers([userId])
    } else {
      setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
    }
  }

  const handleCreate = () => {
    console.log({
      title,
      description,
      complexity,
      selectedUsers,
      selectedDepartment,
      everyoneCanClaim,
      deadline,
      estimatedCost,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>Smart assignment logic based on complexity level</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Title *</Label>
            <Input
              id="task-title"
              placeholder="Enter task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description *</Label>
            <Textarea
              id="task-description"
              placeholder="Describe the task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Complexity Selector with Logic Info */}
          <div className="space-y-3">
            <Label>Complexity Level *</Label>
            <div className="grid grid-cols-3 gap-3">
              <Button
                type="button"
                variant={complexity === "low" ? "default" : "outline"}
                className={cn(
                  "flex flex-col h-auto py-3",
                  complexity === "low" && "bg-success hover:bg-success/90 border-success",
                )}
                onClick={() => handleComplexityChange("low")}
              >
                <span className="font-semibold">Low</span>
                <span className="text-xs mt-1 opacity-90">1 User Only</span>
              </Button>
              <Button
                type="button"
                variant={complexity === "medium" ? "default" : "outline"}
                className={cn(
                  "flex flex-col h-auto py-3",
                  complexity === "medium" && "bg-warning hover:bg-warning/90 border-warning",
                )}
                onClick={() => handleComplexityChange("medium")}
              >
                <span className="font-semibold">Medium</span>
                <span className="text-xs mt-1 opacity-90">Multiple Users</span>
              </Button>
              <Button
                type="button"
                variant={complexity === "high" ? "default" : "outline"}
                className={cn(
                  "flex flex-col h-auto py-3",
                  complexity === "high" && "bg-destructive hover:bg-destructive/90 border-destructive",
                )}
                onClick={() => handleComplexityChange("high")}
              >
                <span className="font-semibold">High</span>
                <span className="text-xs mt-1 opacity-90">Multi or Dept</span>
              </Button>
            </div>
          </div>

          {/* Assignment Logic */}
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <Label>Assignment</Label>
              {complexity === "low" && (
                <Badge variant="secondary" className="text-xs">
                  Max 1 user
                </Badge>
              )}
              {complexity === "medium" && (
                <Badge variant="secondary" className="text-xs">
                  Multiple users allowed
                </Badge>
              )}
              {complexity === "high" && (
                <Badge variant="secondary" className="text-xs">
                  Users or department
                </Badge>
              )}
            </div>

            {/* User Selection */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Select Users:</p>
              <div className="flex flex-wrap gap-2">
                {mockUsers.map((user) => {
                  const isSelected = selectedUsers.includes(user.id)
                  const isDisabled = complexity === "low" && selectedUsers.length === 1 && !isSelected

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleUser(user.id)}
                      disabled={isDisabled}
                      className={cn(
                        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary",
                        isDisabled && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.nickname} />
                        <AvatarFallback className="text-xs">{user.nickname.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span>{user.nickname}</span>
                      {isSelected && <X className="h-3 w-3" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Department Selection (High Complexity Only) */}
            {canSelectDepartment && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label htmlFor="department">Or Assign to Department:</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No department</SelectItem>
                    {mockDepartments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.name}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Everyone Can Claim Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="everyone-claim">Everyone Can Claim</Label>
              <p className="text-xs text-muted-foreground">Allow any team member to claim this task</p>
            </div>
            <Switch id="everyone-claim" checked={everyoneCanClaim} onCheckedChange={setEveryoneCanClaim} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Deadline *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !deadline && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated-cost">Estimated Cost</Label>
              <Input
                id="estimated-cost"
                type="number"
                placeholder="0.00"
                value={estimatedCost}
                onChange={(e) => setEstimatedCost(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!title || !description || !deadline}>
            Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
