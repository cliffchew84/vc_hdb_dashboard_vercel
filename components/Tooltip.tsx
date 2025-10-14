import React, { useState, useLayoutEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: ReactNode;
  targetRef: React.RefObject<HTMLElement>;
}

const Tooltip: React.FC<TooltipProps> = ({ children, targetRef }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Start with an off-screen position to avoid flicker on first render
  const [position, setPosition] = useState({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    if (targetRef.current && tooltipRef.current) {
      const targetRect = targetRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      
      let left = targetRect.left + window.scrollX + (targetRect.width / 2) - (tooltipRect.width / 2);

      // Adjust if it goes off-screen right
      if (left + tooltipRect.width > window.innerWidth - 8) {
        left = window.innerWidth - tooltipRect.width - 8;
      }
      
      // Adjust if it goes off-screen left
      if (left < 8) {
        left = 8;
      }
      
      const gap = 8;
      // Default to showing ABOVE the target
      let top = targetRect.top + window.scrollY - tooltipRect.height - gap;

      // Flip to show BELOW if not enough space at the top of the viewport
      if (top < window.scrollY) {
          top = targetRect.bottom + window.scrollY + gap;
      }

      setPosition({ top, left });
    }
  }, [targetRef, children]); // Rerun if children change, as tooltip size might change

  return createPortal(
    <div
      ref={tooltipRef}
      className="absolute p-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-md shadow-lg z-50"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        maxWidth: '256px', // Equivalent to w-64
      }}
    >
      {children}
    </div>,
    document.body
  );
};

export default Tooltip;
