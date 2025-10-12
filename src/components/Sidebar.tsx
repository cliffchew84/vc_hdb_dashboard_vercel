import React from 'react';
import DateRangeSelector from './DateRangeSelector.tsx';
import MultiSelectDropdown from './MultiSelectDropdown.tsx';
import LeaseRangeSelector from './LeaseRangeSelector.tsx';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  allMonths: string[];
  selectedFlatTypes: string[];
  selectedTowns: string[];
  selectedDateRange: [string, string];
  setSelectedFlatTypes: (types: string[]) => void;
  setSelectedTowns: (towns: string[]) => void;
  setSelectedDateRange: (range: [string, string]) => void;
  resetFilters: () => void;
  flatTypes: string[];
  towns: string[];
  allLeaseYearsDomain: [number, number];
  selectedLeaseRange: [number, number];
  setSelectedLeaseRange: (range: [number, number]) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  setIsOpen,
  allMonths,
  selectedFlatTypes,
  selectedTowns,
  selectedDateRange,
  setSelectedFlatTypes,
  setSelectedTowns,
  setSelectedDateRange,
  resetFilters,
  flatTypes,
  towns,
  allLeaseYearsDomain,
  selectedLeaseRange,
  setSelectedLeaseRange,
}) => {

  return (
    <>
        {/* Backdrop for mobile overlay */}
        <div
            className={`fixed inset-0 bg-black/60 z-30 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
        />

        {/* Sidebar Panel */}
        <aside
            className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-xl lg:shadow-none z-40 transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            `}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sidebar-title"
        >
            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 id="sidebar-title" className="text-xl font-bold text-slate-900 dark:text-white">Filters</h2>
                    <button 
                        onClick={() => setIsOpen(false)} 
                        className="p-2 -mr-2 rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                        aria-label="Close filters sidebar"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 lg:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 hidden lg:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                    </button>
                </div>
                <div className="flex-grow p-4 space-y-6 overflow-y-auto">
                    <div>
                        <MultiSelectDropdown
                            label="Room Type"
                            options={flatTypes}
                            selectedOptions={selectedFlatTypes}
                            onChange={setSelectedFlatTypes}
                            placeholder="All Room Types"
                        />
                    </div>
                    <div>
                        <MultiSelectDropdown
                            label="Town"
                            options={towns}
                            selectedOptions={selectedTowns}
                            onChange={setSelectedTowns}
                            placeholder="All Towns"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Remaining Lease</label>
                         <LeaseRangeSelector
                            min={allLeaseYearsDomain[0]}
                            max={allLeaseYearsDomain[1]}
                            selectedRange={selectedLeaseRange}
                            onChange={setSelectedLeaseRange}
                            disabled={allMonths.length === 0}
                        />
                    </div>
                    <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Date Range</label>
                        <DateRangeSelector
                            allMonths={allMonths}
                            selectedRange={selectedDateRange}
                            onChange={setSelectedDateRange}
                            disabled={allMonths.length === 0}
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={resetFilters}
                        className="w-full px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md shadow-sm hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>
        </aside>
    </>
  );
};

export default Sidebar;