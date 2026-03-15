import * as React from "react"
import { cn } from "@/lib/utils"
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost"
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variant === "default" && "bg-slate-900 text-white hover:bg-slate-800 h-10 px-4 py-2",
        variant === "outline" && "border border-slate-200 bg-white hover:bg-slate-100 h-10 px-4 py-2",
        variant === "ghost" && "hover:bg-slate-100 h-10 px-4 py-2",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = "Button"
export { Button }
