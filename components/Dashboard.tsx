import React from 'react';
import { BoxPlotStats, SummaryStatsData, LineChartDataPoint, BoxPlotMetric, StackedBarChartDataPoint, LineChartMetric, StackedBarChartMode } from '../types.ts';
import Spinner from './Spinner.tsx';
import CollapsibleSection from './CollapsibleSection.tsx';
import SummaryStats from './SummaryStats.tsx';
import BoxPlot from './BoxPlot.tsx';
import LineChart from './LineChart.tsx';
import StackedBarChart from './StackedBarChart.tsx';

interface DashboardProps {
  loading: boolean;
  error: string | null;
  loadingMessage: string;
  processedData: BoxPlotStats[];
  lineChartData: LineChartDataPoint[];
  stackedBarChartData: StackedBarChartDataPoint[];
  summaryStats: SummaryStatsData;
  chartXDomain: string[];
  yDomain: [number, number];
  transactionCountYDomain: [number, number];
  grossTransactionValueYDomain: [number, number];
  medianPsfYDomain: [number, number];
  medianPricePerLeaseYDomain: [number, number];
  millionDollarPercentageYDomain: [number, number];
  stackedBarChartYDomain: [number, number];
  boxPlotMetric: BoxPlotMetric;
  setBoxPlotMetric: (metric: BoxPlotMetric) => void;
  lineChartMetric: LineChartMetric;
  setLineChartMetric: (metric: LineChartMetric) => void;
  stackedBarChartMode: StackedBarChartMode;
  setStackedBarChartMode: (mode: StackedBarChartMode) => void;
  theme: 'light' | 'dark';
}

const boxPlotTitles: Record<BoxPlotMetric, string> = {
  resale_price: 'Monthly Resale Price Distribution',
  price_psf: 'Monthly Price p.s.f. Distribution',
  price_per_lease: 'Monthly Price / Lease Left (Yr) Distribution',
};

const MetricButton: React.FC<{
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, isActive, children, className }) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 text-sm font-semibold rounded-md transition-colors text-center ${
      isActive
        ? 'bg-indigo-600 text-white shadow'
        : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
    } ${className || ''}`}
  >
    {children}
  </button>
);

const Dashboard: React.FC<DashboardProps> = ({
  loading,
  error,
  loadingMessage,
  processedData,
  lineChartData,
  stackedBarChartData,
  summaryStats,
  chartXDomain,
  yDomain,
  transactionCountYDomain,
  grossTransactionValueYDomain,
  medianPsfYDomain,
  medianPricePerLeaseYDomain,
  millionDollarPercentageYDomain,
  stackedBarChartYDomain,
  boxPlotMetric,
  setBoxPlotMetric,
  lineChartMetric,
  setLineChartMetric,
  stackedBarChartMode,
  setStackedBarChartMode,
  theme,
}) => {
  if (error) {
    return (
      <div className="flex justify-center items-center h-[600px] bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg">
        <p>Error fetching data: {error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px]">
        <Spinner />
        <span className="mt-4 text-slate-500 dark:text-slate-400">{loadingMessage || 'Loading...'}</span>
      </div>
    );
  }

  const boxPlotActions = (
    <div className="p-1 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-stretch space-x-1">
      <MetricButton onClick={() => setBoxPlotMetric('resale_price')} isActive={boxPlotMetric === 'resale_price'} className="flex-1">
        Resale Price
      </MetricButton>
      <MetricButton onClick={() => setBoxPlotMetric('price_psf')} isActive={boxPlotMetric === 'price_psf'} className="flex-1">
        Price p.s.f.
      </MetricButton>
      <MetricButton onClick={() => setBoxPlotMetric('price_per_lease')} isActive={boxPlotMetric === 'price_per_lease'} className="flex-1">
        Price / Lease Left (Yr)
      </MetricButton>
    </div>
  );

  const lineChartActions = (
    <div className="p-1 bg-slate-100 dark:bg-slate-900 rounded-lg flex flex-wrap items-stretch gap-1">
      <MetricButton onClick={() => setLineChartMetric('grossTransactionValue')} isActive={lineChartMetric === 'grossTransactionValue'} className="flex-1">
        Gross Txn. Value
      </MetricButton>
      <MetricButton onClick={() => setLineChartMetric('median_psf')} isActive={lineChartMetric === 'median_psf'} className="flex-1">
        Median Price p.s.f.
      </MetricButton>
      <MetricButton onClick={() => setLineChartMetric('median_price_per_lease')} isActive={lineChartMetric === 'median_price_per_lease'} className="flex-1">
        Median Price / Lease (Yr)
      </MetricButton>
      <MetricButton onClick={() => setLineChartMetric('millionDollarTransactionPercentage')} isActive={lineChartMetric === 'millionDollarTransactionPercentage'} className="flex-1">
        % of &gt; $1M Flats
      </MetricButton>
    </div>
  );
  
  const stackedBarChartActions = (
    <div className="p-1 bg-slate-100 dark:bg-slate-900 rounded-lg flex items-stretch space-x-1">
      <MetricButton onClick={() => setStackedBarChartMode('percentage')} isActive={stackedBarChartMode === 'percentage'} className="flex-1">
        % of Sales
      </MetricButton>
      <MetricButton onClick={() => setStackedBarChartMode('count')} isActive={stackedBarChartMode === 'count'} className="flex-1">
        # of Sales
      </MetricButton>
    </div>
  );

  const lineChartY2Domain = React.useMemo(() => {
    if (lineChartMetric === 'median_psf') return medianPsfYDomain;
    if (lineChartMetric === 'median_price_per_lease') return medianPricePerLeaseYDomain;
    if (lineChartMetric === 'millionDollarTransactionPercentage') return millionDollarPercentageYDomain;
    return grossTransactionValueYDomain;
  }, [lineChartMetric, grossTransactionValueYDomain, medianPsfYDomain, medianPricePerLeaseYDomain, millionDollarPercentageYDomain]);
  
  const stackedBarChartTitle = stackedBarChartMode === 'percentage'
    ? '% of Sales by Price Category'
    : '# of Sales by Price Category';
    
  const stackedBarChartDescription = stackedBarChartMode === 'percentage'
    ? "This chart shows the monthly percentage breakdown of HDB resale transactions across different price brackets, with each bar summing to 100%."
    : "This chart shows the absolute number of monthly HDB resale transactions, stacked by price category.";


  return (
    <div className="flex flex-col gap-8">
      <CollapsibleSection title="Transaction Summary">
        <SummaryStats stats={summaryStats} />
      </CollapsibleSection>
      
      <CollapsibleSection 
        title={boxPlotTitles[boxPlotMetric]} 
        actions={boxPlotActions}
        description="This box plot visualizes the distribution of resale prices for each month. Each box represents the interquartile range (IQR), with the line indicating the median. Whiskers extend to the main data range, and individual points represent outliers."
      >
        <div className="w-full h-[500px] p-4 box-border">
          <BoxPlot data={processedData} xDomain={chartXDomain} yDomain={yDomain} boxPlotMetric={boxPlotMetric} theme={theme} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection 
        title="Market Trends"
        actions={lineChartActions}
        description="This chart tracks two key market indicators over time: the total number of monthly transactions (blue bars) and a selectable secondary metric (line)."
      >
        <div className="w-full h-[500px] p-4 box-border">
          <LineChart 
            data={lineChartData}
            xDomain={chartXDomain}
            y1Domain={transactionCountYDomain}
            y2Domain={lineChartY2Domain}
            lineChartMetric={lineChartMetric}
            theme={theme}
          />
        </div>
      </CollapsibleSection>
      
      <CollapsibleSection 
        title={stackedBarChartTitle}
        description={stackedBarChartDescription}
        actions={stackedBarChartActions}
      >
        <div className="w-full h-[500px] p-4 box-border">
          <StackedBarChart
            data={stackedBarChartData}
            xDomain={chartXDomain}
            theme={theme}
            mode={stackedBarChartMode}
            yDomain={stackedBarChartYDomain}
          />
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default Dashboard;
