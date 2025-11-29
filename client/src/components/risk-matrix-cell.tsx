"use client"

import { Badge } from "@/components/ui/badge"
import { Zap } from "lucide-react"

interface RiskMatrixCellProps {
  probability: number
  impact: number
  taskCount: number
  autoAdjustedCount: number
  onClick: () => void
}

export function RiskMatrixCell({ probability, impact, taskCount, autoAdjustedCount, onClick }: RiskMatrixCellProps) {
  const getRiskColor = (prob: number, imp: number) => {
    const score = prob * imp
    if (score >= 20) return "bg-[#dc2626]"
    if (score >= 15) return "bg-[#ea580c]"
    if (score >= 10) return "bg-[#f97316]"
    if (score >= 6) return "bg-[#facc15]"
    if (score >= 3) return "bg-[#84cc16]"
    return "bg-[#22c55e]"
  }

  return (
    <button
      onClick={onClick}
      className={`
        flex-1 aspect-square rounded-lg border-2 border-border/50
        hover:border-primary hover:scale-105 transition-all
        flex flex-col items-center justify-center gap-1
        ${getRiskColor(probability, impact)}
        ${taskCount > 0 ? "cursor-pointer" : "cursor-default opacity-60"}
      `}
    >
      {taskCount > 0 && (
        <>
          <span className="text-lg font-bold text-white drop-shadow-lg">{taskCount}</span>
          {autoAdjustedCount > 0 && (
            <Badge variant="secondary" className="bg-primary/90 text-primary-foreground border-0 text-xs px-1 py-0">
              <Zap className="h-2 w-2 mr-0.5" />
              {autoAdjustedCount}
            </Badge>
          )}
        </>
      )}
    </button>
  )
}
