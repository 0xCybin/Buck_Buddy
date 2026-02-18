import { forwardRef, useImperativeHandle, useCallback } from "react";
import { motion, useAnimate } from "motion/react";

const SimpleCheckedIcon = forwardRef(
  ({ size = 24, color = "currentColor", strokeWidth = 2, className = "" }, ref) => {
    const [scope, animate] = useAnimate();

    const start = useCallback(async () => {
      await animate(".check-path", { pathLength: 0 }, { duration: 0.1, ease: "easeInOut" });
      await animate(".check-path", { pathLength: 1 }, { duration: 0.4, ease: "easeInOut" });
    }, [animate]);

    const stop = useCallback(() => {
      animate(".check-path", { pathLength: 1 }, { duration: 0.2 });
    }, [animate]);

    useImperativeHandle(ref, () => ({ startAnimation: start, stopAnimation: stop }));

    return (
      <motion.svg
        ref={scope}
        onHoverStart={start}
        onHoverEnd={stop}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`cursor-pointer ${className}`}
      >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <motion.path d="M5 12l5 5l10 -10" className="check-path" />
      </motion.svg>
    );
  }
);

SimpleCheckedIcon.displayName = "SimpleCheckedIcon";
export default SimpleCheckedIcon;
