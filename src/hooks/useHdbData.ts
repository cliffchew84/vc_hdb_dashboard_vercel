import { useState, useEffect, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { fetchAllHdbData } from '../services/hdbService.ts';
import { HdbResaleRecord, BoxPlotStats, SummaryStatsData, LineChartDataPoint, BoxPlotMetric, StackedBarChartDataPoint, LineChartMetric, StackedBarChartMode } from '../types.ts';
import {
    calculateBoxPlotData,
    calculateGlobalYDomain,
    calculateSummaryStats,
    calculateLineChartData,
    parseRemainingLeaseToYears,
    calculateGlobalLeaseDomain,
    calculateStackedBarChartData,
} from '../utils/dataProcessor.ts';

// This custom hook encapsulates all logic for fetching, caching, and processing HDB data.
export const useHdbData = () => {
    const [rawRecords, setRawRecords] = useState<HdbResaleRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingMessage, setLoadingMessage] = useState<string>('Initializing...');
    
    // Filter states
    const [selectedFlatTypes, setSelectedFlatTypes] = useState<string[]>([]);
    const [selectedTowns, setSelectedTowns] = useState<string[]>([]);
    const [selectedDateRange, setSelectedDateRange] = useState<[string, string]>(['', '']);
    const [selectedLeaseRange, setSelectedLeaseRange] = useState<[number, number]>([0, 99]);
    const [boxPlotMetric, setBoxPlotMetric] = useState<BoxPlotMetric>('resale_price');
    const [lineChartMetric, setLineChartMetric] = useState<LineChartMetric>('grossTransactionValue');
    const [stackedBarChartMode, setStackedBarChartMode] = useState<StackedBarChartMode>('percentage');

    // Effect to fetch initial raw data on component mount.
    useEffect(() => {
        const loadData = async () => {
            try {
                setLoadingMessage('Fetching latest data from server...');
                const data = await fetchAllHdbData();
                setRawRecords(data);

                // Set initial filters from fetched data
                const allMonths = [...new Set(data.map(r => r.month))].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                if (allMonths.length > 0) {
                    const endDate = allMonths[allMonths.length - 1];
                    const startIndex = Math.max(0, allMonths.length - 12); // Default to last 12 months
                    const startDate = allMonths[startIndex];
                    setSelectedDateRange([startDate, endDate]);
                }
                const leaseDomain = calculateGlobalLeaseDomain(data);
                setSelectedLeaseRange(leaseDomain);

            } catch (e) {
                setError(e instanceof Error ? e.message : 'An unknown error occurred.');
            } finally {
                setLoading(false);
                setLoadingMessage('');
            }
        };
        loadData();
    }, []);

    // Memoized calculation for stable domains for axes and filters.
    const { allMonthsXDomain, yDomain, allLeaseYearsDomain } = useMemo(() => {
        if (rawRecords.length === 0) return { 
            allMonthsXDomain: [], 
            yDomain: [0, 1000000] as [number, number],
            allLeaseYearsDomain: [0, 99] as [number, number],
        };
        const allMonths = [...new Set(rawRecords.map(r => r.month))].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        return { 
            allMonthsXDomain: allMonths, 
            yDomain: calculateGlobalYDomain(rawRecords, boxPlotMetric),
            allLeaseYearsDomain: calculateGlobalLeaseDomain(rawRecords),
        };
    }, [rawRecords, boxPlotMetric]);

    // Function to reset all filters to their default state
    const resetFilters = useCallback(() => {
        setSelectedFlatTypes([]);
        setSelectedTowns([]);
        if (allMonthsXDomain.length > 0) {
            setSelectedDateRange([allMonthsXDomain[0], allMonthsXDomain[allMonthsXDomain.length - 1]]);
        }
        if (allLeaseYearsDomain[0] !== 0 || allLeaseYearsDomain[1] !== 99) {
            setSelectedLeaseRange(allLeaseYearsDomain);
        }
        setBoxPlotMetric('resale_price');
        setLineChartMetric('grossTransactionValue');
        setStackedBarChartMode('percentage');
    }, [allMonthsXDomain, allLeaseYearsDomain]);

    // Memoized filtering of records based on all user selections.
    const filteredRecords = useMemo(() => {
        if (rawRecords.length === 0 || !selectedDateRange[0] || !selectedDateRange[1]) return [];
        
        const startDate = new Date(selectedDateRange[0]);
        const endDate = new Date(selectedDateRange[1]);

        return rawRecords.filter(r => {
            const recordDate = new Date(r.month);
            const isInDateRange = recordDate >= startDate && recordDate <= endDate;
            const isTownMatch = selectedTowns.length === 0 || selectedTowns.includes(r.town);
            const isFlatTypeMatch = selectedFlatTypes.length === 0 || selectedFlatTypes.includes(r.flat_type);

            const leaseYears = parseRemainingLeaseToYears(r.remaining_lease);
            const isLeaseMatch = leaseYears !== null && leaseYears >= selectedLeaseRange[0] && leaseYears <= selectedLeaseRange[1];

            return isInDateRange && isTownMatch && isFlatTypeMatch && isLeaseMatch;
        });
    }, [rawRecords, selectedTowns, selectedFlatTypes, selectedDateRange, selectedLeaseRange]);
    
    // Memoized x-axis domain for the chart, based on the selected date range.
    const chartXDomain = useMemo(() => {
        if (!selectedDateRange[0] || !selectedDateRange[1] || allMonthsXDomain.length === 0) return [];
        const startIndex = allMonthsXDomain.indexOf(selectedDateRange[0]);
        const endIndex = allMonthsXDomain.indexOf(selectedDateRange[1]);
        if (startIndex === -1 || endIndex === -1) return [];
        return allMonthsXDomain.slice(startIndex, endIndex + 1);
    }, [allMonthsXDomain, selectedDateRange]);

    // Memoized processing of filtered records for the box plot.
    const processedData = useMemo<BoxPlotStats[]>(() => 
        calculateBoxPlotData(filteredRecords, chartXDomain, boxPlotMetric), 
        [filteredRecords, chartXDomain, boxPlotMetric]
    );
    
    // Memoized calculation for summary statistics based on filtered data.
    const summaryStats = useMemo<SummaryStatsData>(() => 
        calculateSummaryStats(filteredRecords), 
        [filteredRecords]
    );

    // Memoized processing for the market trends line chart data.
    const { 
        lineChartData, 
        transactionCountYDomain, 
        grossTransactionValueYDomain,
        medianPsfYDomain,
        medianPricePerLeaseYDomain,
        millionDollarPercentageYDomain,
    } = useMemo(() => 
        calculateLineChartData(filteredRecords, chartXDomain), 
        [filteredRecords, chartXDomain]
    );

    // Memoized processing for the price category stacked bar chart.
    const stackedBarChartData = useMemo<StackedBarChartDataPoint[]>(() =>
        calculateStackedBarChartData(filteredRecords, chartXDomain),
        [filteredRecords, chartXDomain]
    );

    // Memoized Y-domain for the stacked bar chart's "count" mode.
    const stackedBarChartYDomain = useMemo<[number, number]>(() => {
        if (stackedBarChartData.length === 0) return [0, 100];
        const maxTotal = d3.max(stackedBarChartData, d => d.totalTransactions) ?? 0;
        return [0, maxTotal * 1.1]; // Add 10% padding to the top
    }, [stackedBarChartData]);

    return {
        loading, error, loadingMessage, processedData, lineChartData, summaryStats, stackedBarChartData,
        allMonthsXDomain, chartXDomain, yDomain, transactionCountYDomain, grossTransactionValueYDomain, medianPsfYDomain, medianPricePerLeaseYDomain, millionDollarPercentageYDomain, stackedBarChartYDomain,
        allLeaseYearsDomain, boxPlotMetric, lineChartMetric, stackedBarChartMode,
        selectedFlatTypes, selectedTowns, selectedDateRange, selectedLeaseRange,
        setSelectedFlatTypes, setSelectedTowns, setSelectedDateRange, setSelectedLeaseRange, setBoxPlotMetric, setLineChartMetric, setStackedBarChartMode,
        resetFilters,
    };
};