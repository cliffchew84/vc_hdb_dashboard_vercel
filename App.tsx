import React, { useState, useEffect } from 'react';
import { useHdbData } from './hooks/useHdbData.ts';
import Dashboard from './components/Dashboard.tsx';
import Sidebar from './components/Sidebar.tsx';
import ThemeToggle from './components/ThemeToggle.tsx';
import { FLAT_TYPES, TOWNS } from './data/constants.ts';
import { formatMonthYear } from './utils/formatters.ts';

// --- Filter Summary Component ---
const FilterPill: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center text-sm bg-slate-100 dark:bg-slate-700 rounded-full px-3 py-1.5">
    <span className="font-semibold mr-1.5 text-slate-500 dark:text-slate-400">{label}:</span>
    <span className="text-slate-800 dark:text-slate-100">{value}</span>
  </div>
);

interface FilterSummaryProps {
  selectedTowns: string[];
  selectedFlatTypes: string[];
  selectedDateRange: [string, string];
  selectedLeaseRange: [number, number];
  allLeaseYearsDomain: [number, number];
  allMonths: string[];
  resetFilters: () => void;
}

const FilterSummary: React.FC<FilterSummaryProps> = ({
  selectedTowns,
  selectedFlatTypes,
  selectedDateRange,
  selectedLeaseRange,
  allLeaseYearsDomain,
  allMonths,
  resetFilters,
}) => {
  const isDefaultDateRange =
    allMonths.length > 0 &&
    selectedDateRange[0] === allMonths[0] &&
    selectedDateRange[1] === allMonths[allMonths.length - 1];
  
  const isDefaultLeaseRange =
    allLeaseYearsDomain.length > 0 &&
    selectedLeaseRange[0] === allLeaseYearsDomain[0] &&
    selectedLeaseRange[1] === allLeaseYearsDomain[1];

  const getPillValue = (selectedItems: string[]): string => {
      if (selectedItems.length === 1) return selectedItems[0];
      if (selectedItems.length > 2) return `${selectedItems.length} selected`;
      return selectedItems.join(', ');
  };

  const activeFilters = [
    selectedTowns.length > 0 && { label: 'Town', value: getPillValue(selectedTowns) },
    selectedFlatTypes.length > 0 && { label: 'Room Type', value: getPillValue(selectedFlatTypes) },
    !isDefaultLeaseRange && { label: 'Lease', value: `${selectedLeaseRange[0]} - ${selectedLeaseRange[1]} yrs` },
    !isDefaultDateRange && {
      label: 'Date Range',
      value: `${formatMonthYear(selectedDateRange[0])} - ${formatMonthYear(
        selectedDateRange[1]
      )}`,
    },
  ].filter(Boolean) as { label: string; value: string }[];

  if (activeFilters.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        {activeFilters.map((filter) => (
          <FilterPill key={filter.label} label={filter.label} value={filter.value} />
        ))}
      </div>
      <button
        onClick={resetFilters}
        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors whitespace-nowrap"
      >
        Clear All Filters
      </button>
    </div>
  );
};


// --- Main App Component ---
const App: React.FC = () => {
  const hdbData = useHdbData();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Set sidebar to be open by default on larger screens
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleResize = () => setIsSidebarOpen(mediaQuery.matches);
    handleResize(); // Set initial state
    mediaQuery.addEventListener('change', handleResize);
    return () => mediaQuery.removeEventListener('change', handleResize);
  }, []);

  // SEO: Dynamically update page title based on filters
  useEffect(() => {
    const baseTitle = 'SG HDB Resale Price Dashboard';
    
    const { selectedFlatTypes, selectedTowns } = hdbData;

    let prefix = '';
    if (selectedFlatTypes.length > 0 || selectedTowns.length > 0) {
        const parts = [];
        if (selectedFlatTypes.length === 1) {
            parts.push(selectedFlatTypes[0]);
        } else if (selectedFlatTypes.length > 1) {
            parts.push(`${selectedFlatTypes.length} Room Types`);
        }

        if (selectedTowns.length === 1) {
            parts.push(`in ${selectedTowns[0]}`);
        } else if (selectedTowns.length > 1) {
            parts.push(`in ${selectedTowns.length} Towns`);
        }
        prefix = parts.join(' ') + ' | ';
    }

    document.title = `${prefix}${baseTitle}`;

  }, [hdbData.selectedFlatTypes, hdbData.selectedTowns]);

  const sidebarProps = {
    isOpen: isSidebarOpen,
    setIsOpen: setIsSidebarOpen,
    allMonths: hdbData.allMonthsXDomain,
    selectedFlatTypes: hdbData.selectedFlatTypes,
    selectedTowns: hdbData.selectedTowns,
    selectedDateRange: hdbData.selectedDateRange,
    setSelectedFlatTypes: hdbData.setSelectedFlatTypes,
    setSelectedTowns: hdbData.setSelectedTowns,
    setSelectedDateRange: hdbData.setSelectedDateRange,
    resetFilters: hdbData.resetFilters,
    flatTypes: FLAT_TYPES,
    towns: TOWNS,
    allLeaseYearsDomain: hdbData.allLeaseYearsDomain,
    selectedLeaseRange: hdbData.selectedLeaseRange,
    setSelectedLeaseRange: hdbData.setSelectedLeaseRange,
  };

  const dashboardProps = {
    loading: hdbData.loading,
    error: hdbData.error,
    loadingMessage: hdbData.loadingMessage,
    processedData: hdbData.processedData,
    lineChartData: hdbData.lineChartData,
    stackedBarChartData: hdbData.stackedBarChartData,
    summaryStats: hdbData.summaryStats,
    chartXDomain: hdbData.chartXDomain,
    yDomain: hdbData.yDomain,
    transactionCountYDomain: hdbData.transactionCountYDomain,
    grossTransactionValueYDomain: hdbData.grossTransactionValueYDomain,
    medianPsfYDomain: hdbData.medianPsfYDomain,
    medianPricePerLeaseYDomain: hdbData.medianPricePerLeaseYDomain,
    millionDollarPercentageYDomain: hdbData.millionDollarPercentageYDomain,
    // FIX: Add missing properties to dashboardProps to match the DashboardProps interface.
    stackedBarChartYDomain: hdbData.stackedBarChartYDomain,
    boxPlotMetric: hdbData.boxPlotMetric,
    setBoxPlotMetric: hdbData.setBoxPlotMetric,
    lineChartMetric: hdbData.lineChartMetric,
    setLineChartMetric: hdbData.setLineChartMetric,
    stackedBarChartMode: hdbData.stackedBarChartMode,
    setStackedBarChartMode: hdbData.setStackedBarChartMode,
    theme,
  };
  
  const filterSummaryProps = {
    selectedTowns: hdbData.selectedTowns,
    selectedFlatTypes: hdbData.selectedFlatTypes,
    selectedDateRange: hdbData.selectedDateRange,
    allMonths: hdbData.allMonthsXDomain,
    resetFilters: hdbData.resetFilters,
    selectedLeaseRange: hdbData.selectedLeaseRange,
    allLeaseYearsDomain: hdbData.allLeaseYearsDomain,
  };

  return (
    <div className="flex h-screen bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <Sidebar {...sidebarProps} />

      <div className={`flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarOpen ? 'lg:ml-80' : 'lg:ml-0'}`}>
        <header className="sticky top-0 z-20 flex flex-col p-4 sm:p-6 lg:p-8 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center w-full">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className={`p-2 mr-4 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 transition-opacity ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
              aria-label="Open filters sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
              Public Home Price Distributions
            </h1>
            <div className="ml-auto">
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
            </div>
          </div>
          <FilterSummary {...filterSummaryProps} />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Dashboard {...dashboardProps} />

          <footer className="text-center mt-8 text-sm text-slate-500 dark:text-slate-400">
            <p>Data sourced from <a href="https://data.gov.sg" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">data.gov.sg</a>.</p>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default App;