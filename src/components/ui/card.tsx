import * as React from "react"
import { cn } from "@/lib/utils"
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("bg-white text-card-foreground overflow-hidden transition-all duration-200 hover:-translate-y-0.5", className)}
      style={{ borderRadius: 14, border: "2px solid #D8D2C6", boxShadow: "0 2px 4px rgba(15,23,42,0.07), 0 8px 24px rgba(15,23,42,0.10), 0 16px 48px rgba(15,23,42,0.05)", ...props.style }}
      {...props} />
  )
)
Card.displayName = "Card"
const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"
const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"
const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"
export { Card, CardHeader, CardTitle, CardContent }
