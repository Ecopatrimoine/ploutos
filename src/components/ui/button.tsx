import * as React from "react"
import { cn } from "@/lib/utils"
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "accent" | "danger"
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", style, ...props }, ref) => (
    <button
      className={cn(
        "inline-flex items-center justify-center text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2",
        variant === "default" && "text-[#F8F7F4]",
        variant === "accent" && "text-[#0F172A]",
        variant === "outline" && "border bg-white text-[#0F172A]",
        variant === "ghost" && "text-[#637896]",
        variant === "danger" && "text-[#991B1B]",
        className
      )}
      style={{
        borderRadius: 8,
        ...(variant === "default" ? { background: "linear-gradient(135deg, #0F172A, #1E293B)", boxShadow: "0 2px 8px rgba(15,23,42,0.2)" } : {}),
        ...(variant === "accent" ? { background: "linear-gradient(135deg, #C4973D, #A07A2E)", boxShadow: "0 2px 8px rgba(196,151,61,0.3)" } : {}),
        ...(variant === "outline" ? { borderColor: "#D8D2C6" } : {}),
        ...(variant === "danger" ? { background: "#FEF2F2", border: "1px solid #FECACA" } : {}),
        ...style,
      }}
      ref={ref}
      {...props}
    />
  )
)
Button.displayName = "Button"
export { Button }
