import * as React from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Simple calendar component that doesn't require react-day-picker
export interface CalendarProps {
  className?: string
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  disabled?: boolean | ((date: Date) => boolean)
  mode?: 'single' | 'range'
  initialFocus?: boolean
}

function Calendar({
  className,
  selected,
  onSelect,
  disabled = false,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(
    selected ? new Date(selected) : new Date()
  )

  const daysInMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  ).getDate()

  const firstDayOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  ).getDay()

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDayClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    
    // Check if date is disabled
    if (typeof disabled === 'function' && disabled(newDate)) {
      return
    }
    if (typeof disabled === 'boolean' && disabled) {
      return
    }
    
    onSelect?.(newDate)
  }

  const isDateDisabled = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    
    if (typeof disabled === 'function') {
      return disabled(date)
    }
    return disabled === true
  }

  const isSelected = (day: number) => {
    if (!selected) return false
    return (
      selected.getDate() === day &&
      selected.getMonth() === currentMonth.getMonth() &&
      selected.getFullYear() === currentMonth.getFullYear()
    )
  }

  const isToday = (day: number) => {
    const today = new Date()
    return (
      today.getDate() === day &&
      today.getMonth() === currentMonth.getMonth() &&
      today.getFullYear() === currentMonth.getFullYear()
    )
  }

  const days: (number | null)[] = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null)
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i)
  }

  return (
    <div className={cn('p-3 bg-background', className)} data-slot="calendar">
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          disabled={disabled}
          className="h-7 w-7"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <div className="font-medium text-sm">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          disabled={disabled}
          className="h-7 w-7"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="text-center text-xs text-muted-foreground font-medium h-8 flex items-center justify-center"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div key={index} className="aspect-square">
            {day !== null && (
              <Button
                variant={isSelected(day) ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleDayClick(day)}
                disabled={isDateDisabled(day)}
                className={cn(
                  'h-8 w-8 p-0 font-normal',
                  isToday(day) && !isSelected(day) && 'bg-accent text-accent-foreground',
                  isSelected(day) && 'bg-primary text-primary-foreground',
                  isDateDisabled(day) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {day}
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export { Calendar }
