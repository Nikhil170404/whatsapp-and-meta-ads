"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
  value: number[]
  onValueChange: (value: number[]) => void
  max: number
  step: number
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    return (
      <input
        type="range"
        ref={ref}
        value={value[0]}
        onChange={(e) => onValueChange([parseFloat(e.target.value)])}
        className={cn(
          "w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary",
          className
        )}
        {...props}
      />
    )
  }
)
Slider.displayName = "Slider"

export { Slider }
