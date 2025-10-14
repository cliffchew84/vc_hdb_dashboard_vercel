import React, { useState, useRef, ReactNode } from 'react';
import Tooltip from './Tooltip.tsx';
import { SummaryStatsData } from '../types.ts';
import { formatCompactCurrency, formatCurrency, formatNumber, formatPercentage } from '../utils/formatters.ts';

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
