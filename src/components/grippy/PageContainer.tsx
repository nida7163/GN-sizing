import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  stepKey: string | number;
  children: React.ReactNode;
  className?: string;
}

const variants = {
  enter: { opacity: 0, x: 32 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
};

export function PageContainer({ stepKey, children, className }: PageContainerProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.3, ease: [0.32, 0, 0.67, 0] }}
        className={cn("w-full", className)}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
