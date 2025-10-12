import * as d3 from 'd3';
import { HdbResaleRecord, BoxPlotStats, Outlier, SummaryStatsData, LineChartDataPoint, BoxPlotMetric, StackedBarChartDataPoint, PRICE_CATEGORIES } from '../types.ts';

const SQM_TO_SQFT_CONVERSION = 10.7639;

/**
 * Parses a "X years Y months" string into a fractional number of years.
 * @param leaseStr The string to parse (e.g., "69 years 04 months").
 * @returns The total number of years, or null if parsing fails.
 */
export const parseRemainingLeaseToYears = (leaseStr: string | undefined): number | null => {
    if (!leaseStr) return null;
    const match = leaseStr.match(/(\d+)\s+years?(?:\s+(\d+)\s+months?)?/);
    if (!match) return null;
    
    const years = parseInt(match[1], 10);
    const months = match[2] ? parseInt(match[2], 10) : 0;
    
    return years + (months / 12);
};

// Processes a single group of records (for one month) into box plot statistics for a given metric.
const processRecordGroup = (records: HdbResaleRecord[], metric: BoxPlotMetric): BoxPlotStats | null => {
    if (records.length === 0) return null;
    const month = records[0].month;
    
    const processedRecords = records
        .map(r => {
            const resale_price = parseFloat(r.resale_price);
            const area_sqm = r.floor_area_sqm ? parseFloat(r.floor_area_sqm) : NaN;
            const lease_years = parseRemainingLeaseToYears(r.remaining_lease);

            let value: number | null = null;
            if (metric === 'resale_price') {
                value = resale_price;
            } else if (metric === 'price_psf' && !isNaN(area_sqm) && area_sqm > 0) {
                value = resale_price / (area_sqm * SQM_TO_SQFT_CONVERSION);
            } else if (metric === 'price_per_lease' && lease_years !== null && lease_years > 0) {
                value = resale_price / lease_years;
            }

            return {
                value,
                resale_price,
                flat_type: r.flat_type,
                town: r.town,
                remaining_lease: r.remaining_lease,
                floor_area_sqm: r.floor_area_sqm,
            };
        })
        .filter(r => r.value !== null && !isNaN(r.value) && r.flat_type && r.town) as {
            value: number;
            resale_price: number;
            flat_type: string;
            town: string;
            remaining_lease?: string;
            floor_area_sqm?: string;
        }[];

    if (processedRecords.length < 5) return null; // Need enough data points
    
    const sortedValues = processedRecords.map(r => r.value).sort(d3.ascending);
    const q1 = d3.quantile(sortedValues, 0.25) ?? 0;
    const median = d3.quantile(sortedValues, 0.5) ?? 0;
    const q3 = d3.quantile(sortedValues, 0.75) ?? 0;
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;

    const outliers: Outlier[] = processedRecords
        .filter(r => r.value < lowerFence || r.value > upperFence)
        .map(r => ({
            price: r.value,
            resale_price: r.resale_price,
            flat_type: r.flat_type,
            town: r.town,
            remaining_lease: r.remaining_lease,
            floor_area_sqm: r.floor_area_sqm,
        }));
        
    const nonOutlierValues = processedRecords.filter(r => r.value >= lowerFence && r.value <= upperFence).map(r => r.value);
    const min = d3.min(nonOutlierValues) ?? q1;
    const max = d3.max(nonOutlierValues) ?? q3;

    return { month, min, q1, median, q3, max, outliers };
};

export const calculateBoxPlotData = (records: HdbResaleRecord[], xDomain: string[], metric: BoxPlotMetric): BoxPlotStats[] => {
    if (records.length === 0) return [];
    const recordsByMonth = d3.group(records, d => d.month);
    const data: BoxPlotStats[] = [];
    for (const month of xDomain) {
        const monthRecords = recordsByMonth.get(month);
        if (monthRecords) {
            const stats = processRecordGroup(monthRecords, metric);
            if (stats) data.push(stats);
        }
    }
    return data.sort((a,b) => new Date(a.month).getTime() - new Date(b.month).getTime());
};

export const calculateGlobalYDomain = (records: HdbResaleRecord[], metric: BoxPlotMetric): [number, number] => {
    if (records.length === 0) return [0, 1000000];
    const recordsByMonthGroup = d3.group(records, d => d.month);
    let globalMax = 0;
    for (const monthRecords of recordsByMonthGroup.values()) {
        const stats = processRecordGroup(monthRecords, metric);
        if (stats) {
            const monthMax = d3.max([stats.max, ...stats.outliers.map(o => o.price)]) ?? 0;
            if (monthMax > globalMax) globalMax = monthMax;
        }
    }
    return [0, globalMax * 1.05];
};

export const calculateGlobalLeaseDomain = (records: HdbResaleRecord[]): [number, number] => {
    if (records.length === 0) return [0, 99];
    
    const leaseYears = records
        .map(r => parseRemainingLeaseToYears(r.remaining_lease))
        .filter(y => y !== null) as number[];
        
    if (leaseYears.length === 0) return [0, 99];

    const minLease = Math.floor(d3.min(leaseYears) ?? 0);
    const maxLease = Math.ceil(d3.max(leaseYears) ?? 99);
    
    return [minLease, maxLease];
};

export const calculateSummaryStats = (records: HdbResaleRecord[]): SummaryStatsData => {
    if (records.length === 0) return { count: 0 };
    
    const validRecords = records.map(r => ({
        price: parseFloat(r.resale_price),
        area_sqm: r.floor_area_sqm ? parseFloat(r.floor_area_sqm) : NaN,
        lease_years: parseRemainingLeaseToYears(r.remaining_lease),
    })).filter(r => !isNaN(r.price));
    
    if (validRecords.length === 0) return { count: 0 };
    
    const prices = validRecords.map(r => r.price).sort(d3.ascending);

    const validPsfRecords = validRecords.filter(r => !isNaN(r.area_sqm) && r.area_sqm > 0);
    const psfValues = validPsfRecords.map(r => r.price / (r.area_sqm * SQM_TO_SQFT_CONVERSION)).sort(d3.ascending);
    
    const validLeaseRecords = validRecords.filter(r => r.lease_years !== null && r.lease_years > 0);
    const pricePerLeaseValues = validLeaseRecords.map(r => r.price / r.lease_years!).sort(d3.ascending);
    
    const millionDollarTransactions = prices.filter(p => p >= 1000000).length;
    const millionDollarTransactionPercentage = prices.length > 0 ? (millionDollarTransactions / prices.length) * 100 : 0;

    return {
        count: prices.length,
        median: d3.quantile(prices, 0.5),
        min: prices.length > 0 ? prices[0] : undefined,
        max: prices.length > 0 ? prices[prices.length - 1] : undefined,
        median_psf: d3.quantile(psfValues, 0.5),
        min_psf: psfValues.length > 0 ? psfValues[0] : undefined,
        max_psf: psfValues.length > 0 ? psfValues[psfValues.length - 1] : undefined,
        grossTransactionValue: d3.sum(prices),
        median_price_per_lease: d3.quantile(pricePerLeaseValues, 0.5),
        min_price_per_lease: pricePerLeaseValues.length > 0 ? pricePerLeaseValues[0] : undefined,
        max_price_per_lease: pricePerLeaseValues.length > 0 ? pricePerLeaseValues[pricePerLeaseValues.length - 1] : undefined,
        millionDollarTransactionPercentage: millionDollarTransactionPercentage,
    };
};

export const calculateLineChartData = (records: HdbResaleRecord[], xDomain: string[]) => {
    if (records.length === 0) {
        return {
            lineChartData: [],
            transactionCountYDomain: [0, 100] as [number, number],
            grossTransactionValueYDomain: [0, 1000000] as [number, number],
            medianPsfYDomain: [0, 1000] as [number, number],
            medianPricePerLeaseYDomain: [0, 1000] as [number, number],
            millionDollarPercentageYDomain: [0, 5] as [number, number],
        };
    }
    
    const recordsByMonth = d3.group(records, d => d.month);
    const data: LineChartDataPoint[] = [];

    for (const month of xDomain) {
        const monthRecords = recordsByMonth.get(month) ?? [];
        const validRecords = monthRecords.map(r => ({
            price: parseFloat(r.resale_price),
            area_sqm: r.floor_area_sqm ? parseFloat(r.floor_area_sqm) : NaN,
            lease_years: parseRemainingLeaseToYears(r.remaining_lease),
        })).filter(r => !isNaN(r.price));

        if (validRecords.length > 0) {
            const prices = validRecords.map(r => r.price);
            
            const validPsfRecords = validRecords.filter(r => !isNaN(r.area_sqm) && r.area_sqm > 0);
            const psfValues = validPsfRecords.map(r => r.price / (r.area_sqm * SQM_TO_SQFT_CONVERSION)).sort(d3.ascending);

            const validLeaseRecords = validRecords.filter(r => r.lease_years !== null && r.lease_years > 0);
            const pricePerLeaseValues = validLeaseRecords.map(r => r.price / r.lease_years!).sort(d3.ascending);
            
            const millionDollarTransactions = prices.filter(p => p >= 1000000).length;
            const millionDollarTransactionPercentage = prices.length > 0 ? (millionDollarTransactions / prices.length) * 100 : 0;
            
            data.push({
                month,
                transactionCount: validRecords.length,
                grossTransactionValue: d3.sum(prices),
                median_psf: d3.quantile(psfValues, 0.5),
                median_price_per_lease: d3.quantile(pricePerLeaseValues, 0.5),
                millionDollarTransactionPercentage,
            });
        } else {
             data.push({ 
                 month, 
                 transactionCount: undefined, 
                 grossTransactionValue: undefined,
                 median_psf: undefined,
                 median_price_per_lease: undefined,
                 millionDollarTransactionPercentage: undefined,
             });
        }
    }
    
    const validTransactionCounts = data.map(d => d.transactionCount).filter(d => d !== undefined) as number[];
    const transactionCountDomain = d3.extent(validTransactionCounts);
    
    const validGrossTransactionValues = data.map(d => d.grossTransactionValue).filter(d => d !== undefined) as number[];
    const grossTransactionValueDomain = d3.extent(validGrossTransactionValues);

    const validMedianPsfs = data.map(d => d.median_psf).filter(d => d !== undefined) as number[];
    const medianPsfDomain = d3.extent(validMedianPsfs);

    const validMedianPricePerLeases = data.map(d => d.median_price_per_lease).filter(d => d !== undefined) as number[];
    const medianPricePerLeaseDomain = d3.extent(validMedianPricePerLeases);
    
    const validMillionDollarPercentages = data.map(d => d.millionDollarTransactionPercentage).filter(d => d !== undefined) as number[];
    const millionDollarPercentageDomain = d3.extent(validMillionDollarPercentages);
    
    const maxTransactionCount = transactionCountDomain[1] ?? 0;
    const maxGrossTransactionValue = grossTransactionValueDomain[1] ?? 0;
    const maxMedianPsf = medianPsfDomain[1] ?? 0;
    const maxMedianPricePerLease = medianPricePerLeaseDomain[1] ?? 0;
    const maxMillionDollarPercentage = millionDollarPercentageDomain[1] ?? 0;

    return {
        lineChartData: data,
        transactionCountYDomain: [0, maxTransactionCount * 1.2] as [number, number],
        grossTransactionValueYDomain: [0, maxGrossTransactionValue * 1.05] as [number, number],
        medianPsfYDomain: [0, maxMedianPsf * 1.05] as [number, number],
        medianPricePerLeaseYDomain: [0, maxMedianPricePerLease * 1.05] as [number, number],
        millionDollarPercentageYDomain: [0, maxMillionDollarPercentage * 1.05] as [number, number],
    };
};


export const calculateStackedBarChartData = (records: HdbResaleRecord[], xDomain: string[]): StackedBarChartDataPoint[] => {
    if (records.length === 0) return [];

    const recordsByMonth = d3.group(records, d => d.month);
    const data: StackedBarChartDataPoint[] = [];

    for (const month of xDomain) {
        const monthRecords = recordsByMonth.get(month) ?? [];
        
        const priceCounts = {
            '0-300k': 0,
            '300-500k': 0,
            '500-800k': 0,
            '800k-1m': 0,
            '>=1m': 0,
        };

        let totalTransactions = 0;
        for (const record of monthRecords) {
            const price = parseFloat(record.resale_price);
            if (isNaN(price)) continue;
            
            totalTransactions++;
            
            // Logic updated to use [lower, upper) intervals.
            // e.g., '300-500k' includes 300,000 but not 500,000.
            if (price < 300000) {
                priceCounts['0-300k']++;
            } else if (price < 500000) {
                priceCounts['300-500k']++;
            } else if (price < 800000) {
                priceCounts['500-800k']++;
            } else if (price < 1000000) {
                priceCounts['800k-1m']++;
            } else { // price >= 1,000,000
                priceCounts['>=1m']++;
            }
        }
        
        data.push({
            month,
            ...priceCounts,
            totalTransactions,
        });
    }

    return data;
};