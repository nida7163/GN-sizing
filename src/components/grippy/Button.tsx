import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GrippyButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function GrippyButton({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...props
}: GrippyButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-unbounded font-semibold tracking-tight transition-colors disabled:opacity-40 disabled:pointer-events-none";

  const variants = {
    primary: "bg-grippy-cobalt text-grippy-cream hover:bg-grippy-cobalt-dark active:scale-[0.98]",
    ghost: "bg-transparent text-grippy-black border border-grippy-black hover:bg-grippy-black hover:text-grippy-cream",
    outline: "bg-grippy-cream text-grippy-black border border-grippy-black/20 hover:border-grippy-black",
  };

  const sizes = {
    sm: "text-xs px-5 py-3",
    md: "text-sm px-7 py-4",
    lg: "text-base px-8 py-5",
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
