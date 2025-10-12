import React, { useState, useLayoutEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { SummaryStatsData } from '../types.ts';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercentage } from '../utils/formatters.ts';

// --- New Portal-based Tooltip Component ---
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


// --- Original Components (Modified to use new Tooltip) ---
const InfoIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const StatCard: React.FC<{ label: string; value: string; tooltip?: string }> = ({ label, value, tooltip }) => {
    const [isTooltipVisible, setIsTooltipVisible] = useState(false);
    const triggerRef = useRef<HTMLSpanElement>(null);

    return (
        <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg">
          <dt 
            className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5"
            onMouseEnter={() => tooltip && setIsTooltipVisible(true)}
            onMouseLeave={() => tooltip && setIsTooltipVisible(false)}
          >
            <span>{label}</span>
            {tooltip && (
                <span ref={triggerRef}>
                    <InfoIcon />
                </span>
            )}
          </dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">{value}</dd>

          {isTooltipVisible && tooltip && triggerRef.current && (
            <Tooltip targetRef={triggerRef}>
                {tooltip}
            </Tooltip>
          )}
        </div>
    );
};

interface SummaryStatsProps {
  stats: SummaryStatsData;
}

const SummaryStats: React.FC<SummaryStatsProps> = ({ stats }) => {
  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Market Overview */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Transactions" value={formatNumber(stats.count)} />
        <StatCard 
          label="Gross Transaction Value" 
          value={formatCompactCurrency(stats.grossTransactionValue)}
          tooltip="The sum of all resale transaction prices for the selected filters, representing the total sales value for the filtered segment."
        />
        <StatCard 
          label="% of Million-Dollar Flats" 
          value={formatPercentage(stats.millionDollarTransactionPercentage)}
          tooltip="The percentage of resale transactions for the selected filters that were sold for S$1,000,000 or more."
        />
      </dl>

      {/* Row 2: Resale Price Statistics */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Highest Resale Price" value={formatCurrency(stats.max)} />
        <StatCard label="Median Resale Price" value={formatCurrency(stats.median)} />
        <StatCard label="Lowest Resale Price" value={formatCurrency(stats.min)} />
      </dl>
      
      {/* Row 3: Price Per Square Foot (PSF) Statistics */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Highest Price p.s.f." value={formatCurrency(stats.max_psf)} />
        <StatCard 
          label="Median Price p.s.f." 
          value={formatCurrency(stats.median_psf)} 
          tooltip="The median of all resale transaction prices divided by their floor area in square feet (p.s.f.). This metric provides a standardized measure of property value, adjusting for flat size."
        />
        <StatCard label="Lowest Price p.s.f." value={formatCurrency(stats.min_psf)} />
      </dl>

      {/* Row 4: Price Per Remaining Lease Statistics */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Highest Price / Lease Left (Yr)" value={formatCurrency(stats.max_price_per_lease)} />
        <StatCard 
          label="Median Price / Lease Left (Yr)" 
          value={formatCurrency(stats.median_price_per_lease)} 
          tooltip="The resale price divided by the number of years remaining on the flat's 99-year lease at the time of transaction. This metric helps normalize prices across flats of different ages."
        />
        <StatCard label="Lowest Price / Lease Left (Yr)" value={formatCurrency(stats.min_price_per_lease)} />
      </dl>
    </div>
  );
};

export default SummaryStats;