import * as React from "react"
import { cn } from "@/lib/utils"
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "ploutos-field flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none disabled:cursor-not-allowed",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"
export { Input }
