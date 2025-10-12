import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { BoxPlotStats, Outlier, BoxPlotMetric } from '../types.ts';
import { formatCurrency, formatPsf, parseRemainingLeaseToYears } from '../utils/formatters.ts';

const SQM_TO_SQFT_CONVERSION = 10.7639;

interface BoxPlotProps {
  data: BoxPlotStats[];
  xDomain: string[];
  yDomain: [number, number];
  boxPlotMetric: BoxPlotMetric;
  theme: 'light' | 'dark';
}

const yAxisLabels: Record<BoxPlotMetric, string> = {
  resale_price: 'Resale Price',
  price_psf: 'Price per sq. ft.',
  price_per_lease: 'Price / Lease Left (Yr)',
};

const BoxPlot: React.FC<BoxPlotProps> = ({ data, xDomain, yDomain, boxPlotMetric, theme }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const chartElementsRef = useRef<{ 
      g?: d3.Selection<SVGGElement, unknown, null, undefined>,
      xAxis?: d3.Selection<SVGGElement, unknown, null, undefined>,
      yAxis?: d3.Selection<SVGGElement, unknown, null, undefined>,
      grid?: d3.Selection<SVGGElement, unknown, null, undefined>,
      yearSeparators?: d3.Selection<SVGGElement, unknown, null, undefined>,
      noDataMessage?: d3.Selection<SVGTextElement, unknown, null, undefined>
  }>({});

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const isDarkMode = theme === 'dark';

  // Effect to handle responsive resizing of the chart
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver(entries => {
        if (entries && entries.length > 0 && entries[0].contentRect.width > 0) {
            const { width, height } = entries[0].contentRect;
            setDimensions({ width, height });
        }
    });
    resizeObserver.observe(containerRef.current);
    return () => {
        if (containerRef.current) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            resizeObserver.unobserve(containerRef.current);
        }
    };
  }, []);

  const themeColors = useMemo(() => (isDarkMode ? {
    stroke: "#94a3b8",      // slate-400
    fill: "#334155",        // slate-700
    median: "#38bdf8",      // sky-400
    hoverStroke: "#cbd5e1", // slate-300
    hoverFill: "#475569",   // slate-600
    hoverMedian: "#7dd3fc", // sky-300
  } : {
    stroke: "#64748b",      // slate-500
    fill: "#f1f5f9",        // slate-100
    median: "#4f46e5",      // indigo-600
    hoverStroke: "#475569", // slate-600
    hoverFill: "#e2e8f0",   // slate-200
    hoverMedian: "#4338ca", // indigo-700
  }), [isDarkMode]);

  // Effect for one-time setup of chart structure
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    
    const { height } = containerRef.current.getBoundingClientRect();
    const margin = { top: 30, right: 10, bottom: 50, left: 75 };
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    const g = svg.append('g').attr('class', 'chart-area').attr('transform', `translate(${margin.left}, ${margin.top})`);
          
    g.append('text').attr('class', 'y-axis-label')
      .style("text-anchor", "start").style("font-size", "14px").style('font-weight', '600')
      .style("fill", "currentColor");

    chartElementsRef.current = {
        g,
        grid: g.append('g').attr('class', 'grid').attr('pointer-events', 'none'),
        yearSeparators: g.append('g').attr('class', 'year-separators').attr('pointer-events', 'none'),
        yAxis: g.append('g').attr('class', 'y-axis'),
        xAxis: g.append('g').attr('class', 'x-axis').attr('transform', `translate(0, ${innerHeight})`),
        noDataMessage: g.append('text').attr('class', 'no-data-message')
    };
  }, []);

  // Effect for updating the chart when data or dimensions change
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !tooltipRef.current || !chartElementsRef.current.g || dimensions.width === 0) return;
    
    const { g, xAxis, yAxis, grid, yearSeparators, noDataMessage } = chartElementsRef.current;
    
    const { width, height } = dimensions;
    const margin = { top: 30, right: 10, bottom: 50, left: 75 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    d3.select(svgRef.current).attr('width', width).attr('height', height);
    g.attr('transform', `translate(${margin.left}, ${margin.top})`);
    xAxis?.attr('transform', `translate(0, ${innerHeight})`);
    
    g.select<SVGTextElement>('.y-axis-label')
      .attr('x', 0)
      .attr('y', -12) // Position in top margin
      .text(yAxisLabels[boxPlotMetric]);

    const x = d3.scaleBand().range([0, innerWidth]).domain(xDomain).paddingInner(0.1).paddingOuter(0.05);
    const y = d3.scaleLinear().domain(yDomain).nice().range([innerHeight, 0]);

    const valueFormatter = (metric: BoxPlotMetric, value: d3.NumberValue) => {
        if (metric === 'resale_price') return d3.format(".2s")(Number(value)).replace(/G/, "B");
        if (metric === 'price_psf') return formatPsf(Number(value));
        return formatCurrency(Number(value));
    };

    const numMonths = xDomain.length;
    let tickValues: string[];

    if (numMonths > 36) { // > 3 years, show every 6 months
        tickValues = xDomain.filter((d, i) => i % 6 === 0);
    } else if (numMonths > 24) { // > 2 years, show quarterly
        tickValues = xDomain.filter((d, i) => i % 3 === 0);
    } else if (numMonths > 12) { // > 1 year, show every other month
        tickValues = xDomain.filter((d, i) => i % 2 === 0);
    } else { // <= 1 year, show all months
        tickValues = xDomain;
    }

    // Ensure the last month is always a tick to clearly show the end of the range.
    if (numMonths > 0 && !tickValues.includes(xDomain[xDomain.length - 1])) {
      tickValues.push(xDomain[xDomain.length - 1]);
    }

    const xAxisGenerator = d3.axisBottom(x).tickValues(tickValues).tickFormat((d: string) => {
        const date = new Date(`${d}-01T12:00:00Z`);
        // Always show year for January.
        if (date.getMonth() === 0) {
            return d3.timeFormat('%b \'%y')(date);
        }
        // If we are showing more than a year's worth of data, also show year for context.
        if (numMonths > 12) {
            return d3.timeFormat('%b \'%y')(date);
        }
        return d3.timeFormat('%b')(date);
    }).tickSizeOuter(0);

    xAxis?.transition().duration(500).call(xAxisGenerator)
      .call((s: any) => s.select(".domain").remove())
      .call((g: any) => g.selectAll(".tick text")
        .style("font-weight", "600")
        .style("font-size", "11px"));

    yAxis?.transition().duration(500).call(d3.axisLeft(y).ticks(8).tickFormat(d => valueFormatter(boxPlotMetric, d))).call((s: any) => s.selectAll(".domain, line").remove());
    grid?.lower().transition().duration(500).call(d3.axisLeft(y).ticks(8).tickSize(-innerWidth).tickFormat(() => "")).call((s: any) => s.select(".domain").remove()).call((s: any) => s.selectAll("line").attr('stroke', 'currentColor').attr('stroke-opacity', 0.1).attr('stroke-dasharray', '2,2'));
    
    const yearStartMonths = xDomain.filter(m => m.endsWith('-01')).slice(1);
    yearSeparators?.lower().selectAll('line').data(yearStartMonths, (d: any) => d)
      .join(
        (enter: any) => enter.append('line').attr('y1', 0).attr('y2', innerHeight).attr('stroke', 'currentColor').attr('stroke-opacity', 0).attr('stroke-dasharray', '3,3'),
        (update: any) => update,
        (exit: any) => exit.transition().duration(500).attr('stroke-opacity', 0).remove()
      ).transition().duration(500)
        .attr('x1', (d: string) => (x(d) ?? 0) - (x.step() * x.paddingOuter()))
        .attr('x2', (d: string) => (x(d) ?? 0) - (x.step() * x.paddingOuter()))
        .attr('stroke-opacity', 0.2);
        
    noDataMessage?.attr('x', innerWidth / 2).attr('y', innerHeight / 2)
        .attr('text-anchor', 'middle').attr('alignment-baseline', 'middle')
        .style('font-size', '16px').style('fill', 'currentColor')
        .text(data.length === 0 ? 'No Data for selected filters' : '');

    const tooltip = d3.select(tooltipRef.current);
    const boxWidth = x.bandwidth();

    const positionTooltip = (event: MouseEvent) => {
        const tooltipNode = tooltip.node() as HTMLElement;
        const containerNode = containerRef.current;
        if (!tooltipNode || !containerNode) return;
        const { width: tooltipWidth, height: tooltipHeight } = tooltipNode.getBoundingClientRect();
        const containerRect = containerNode.getBoundingClientRect();
        const offset = 15, margin = 10;
        let left = Math.max(margin, Math.min(event.clientX - containerRect.left - tooltipWidth / 2, containerRect.width - tooltipWidth - margin));
        let top = event.clientY - containerRect.top - tooltipHeight - offset;
        if (top < margin) top = event.clientY - containerRect.top + offset;
        tooltip.style('left', `${left}px`).style('top', `${top}px`);
    };
    
    const boxplotGroups = g.selectAll<SVGGElement, BoxPlotStats>('g.boxplot').data(data, (d: any) => d.month);
    
    const enterGroups = boxplotGroups.enter().append('g').attr('class', 'boxplot')
        .attr('transform', d => `translate(${x(d.month) ?? 0}, 0)`).attr('opacity', 0);
    enterGroups.append('line').attr('class', 'whisker');
    enterGroups.append('rect').attr('class', 'box');
    enterGroups.append('line').attr('class', 'median-line');
    enterGroups.append('g').attr('class', 'outliers-g');

    const allGroups = enterGroups.merge(boxplotGroups);
    boxplotGroups.exit().transition().duration(500).attr('opacity', 0).remove();
    
    allGroups.transition().duration(500).delay(100).attr('transform', d => `translate(${x(d.month) ?? 0}, 0)`).attr('opacity', 1);

    allGroups.select<SVGLineElement>('.whisker').transition().duration(500).delay(100)
      .attr('x1', boxWidth / 2).attr('x2', boxWidth / 2).attr('y1', d => y(d.min)).attr('y2', d => y(d.max))
      .attr('stroke', themeColors.stroke).attr('stroke-width', 1.5);

    allGroups.select<SVGRectElement>('.box').transition().duration(500).delay(100)
      .attr('y', d => y(d.q3)).attr('height', d => Math.max(0, y(d.q1) - y(d.q3)))
      .attr('width', boxWidth).attr('rx', 3).attr('ry', 3)
      .attr('stroke', themeColors.stroke).attr('stroke-width', 2).style('fill', themeColors.fill);

    allGroups.select<SVGLineElement>('.median-line').transition().duration(500).delay(100)
      .attr('x1', 0).attr('x2', boxWidth).attr('y1', d => y(d.median)).attr('y2', d => y(d.median))
      .attr('stroke', themeColors.median).style('stroke-width', '3px');

    allGroups.select<SVGGElement>('.outliers-g').each(function (d: BoxPlotStats) {
        const outlierCircles = d3.select(this)
            .selectAll<SVGCircleElement, Outlier>('circle')
            .data(d.outliers, (o: Outlier) => `${o.town}-${o.flat_type}-${o.resale_price}`);
        
        outlierCircles.exit().transition().duration(200).attr('r', 0).remove();

        outlierCircles.enter()
            .append('circle')
            .attr('cy', (outlier: Outlier) => y(outlier.price))
            .attr('cx', () => (boxWidth / 2) + (Math.random() - 0.5) * boxWidth * 0.6)
            .attr('r', 0)
            .merge(outlierCircles)
            .on('mouseover', function (event: MouseEvent, outlier: Outlier) {
                event.stopPropagation();
                d3.select(this).transition().duration(200).attr('r', 6).attr('fill', themeColors.hoverFill).attr('stroke', themeColors.hoverStroke);
                tooltip.style('opacity', 1).style('display', 'block');
            })
            .on('mousemove', function (event: MouseEvent, outlier: Outlier) {
                event.stopPropagation();

                const area_sqm = outlier.floor_area_sqm ? parseFloat(outlier.floor_area_sqm) : NaN;
                const area_sqft = !isNaN(area_sqm) ? Math.round(area_sqm * SQM_TO_SQFT_CONVERSION) : null;
                const psf = !isNaN(area_sqm) && area_sqm > 0 ? outlier.resale_price / (area_sqm * SQM_TO_SQFT_CONVERSION) : null;
                const lease_years = parseRemainingLeaseToYears(outlier.remaining_lease);
                const price_per_lease = lease_years && lease_years > 0 ? outlier.resale_price / lease_years : null;
                const formattedLease = outlier.remaining_lease
                    ?.replace(/years/g, 'yrs')
                    .replace(/months/g, 'mths')
                    .replace(/ /g, '&nbsp;') || 'N/A';


                const metricRow = (label: string, value: string, isPrimary: boolean) => `
                  <span class="font-medium text-slate-500 dark:text-slate-400 ${isPrimary ? 'text-indigo-500 dark:text-indigo-400' : ''}">${label}</span>
                  <span class="text-right font-semibold ${isPrimary ? 'text-indigo-500 dark:text-indigo-400' : ''}">${value}</span>
                `;
                
                tooltip.html(
                    `<div class="p-1">
                        <div class="font-bold text-center mb-1 pb-1 border-b border-slate-200 dark:border-slate-600">Outlier Transaction</div>
                        <div class="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs mt-2">
                            ${metricRow('Resale Price', formatCurrency(outlier.resale_price), boxPlotMetric === 'resale_price')}
                            ${metricRow('Price / Sq Feet', psf ? formatPsf(psf) : 'N/A', boxPlotMetric === 'price_psf')}
                            ${metricRow('Price / Lease Left (Yr)', price_per_lease ? formatCurrency(price_per_lease) : 'N/A', boxPlotMetric === 'price_per_lease')}
                            <span class="col-span-2 my-1 border-t border-slate-200 dark:border-slate-600"></span>
                            <span class="font-medium text-slate-500 dark:text-slate-400">Month</span>
                            <span class="text-right">${d3.timeFormat('%b-%y')(new Date(d.month))}</span>
                            <span class="font-medium text-slate-500 dark:text-slate-400">Town</span>
                            <span class="text-right">${outlier.town}</span>
                            <span class="font-medium text-slate-500 dark:text-slate-400">Room Type</span>
                            <span class="text-right">${outlier.flat_type.replace(/ /g, '&nbsp;')}</span>
                            <span class="font-medium text-slate-500 dark:text-slate-400">Area</span>
                            <span class="text-right">${area_sqft ? `${area_sqft.toLocaleString()}&nbsp;sqft` : 'N/A'}</span>
                            <span class="font-medium text-slate-500 dark:text-slate-400">Lease Left</span>
                            <span class="text-right">${formattedLease}</span>
                        </div>
                     </div>`
                );
                positionTooltip(event);
            })
            .on('mouseleave', function (event: MouseEvent) {
                event.stopPropagation();
                d3.select(this).transition().duration(200).attr('r', 3).attr('fill', themeColors.fill).attr('stroke', themeColors.stroke);
                tooltip.style('opacity', 0).style('display', 'none');
            })
            .transition().duration(500)
            .attr('r', 3)
            .attr('fill', themeColors.fill)
            .attr('stroke', themeColors.stroke)
            .attr('stroke-width', 1);
    });

    allGroups
        .on('mouseover', function () {
            const group = d3.select(this);
            group.select('.box').transition().duration(150).attr('fill', themeColors.hoverFill).attr('stroke', themeColors.hoverStroke);
            group.select('.median-line').transition().duration(150).attr('stroke', themeColors.hoverMedian);
            tooltip.style('opacity', 1).style('display', 'block');
        }).on('mousemove', function (event, d: BoxPlotStats) {
            tooltip.html(`<div class="font-bold text-center mb-2">${d3.timeFormat('%B %Y')(new Date(d.month))}</div><div class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs"><span>Max:</span> <span class="text-right font-semibold">${valueFormatter(boxPlotMetric, d.max)}</span><span>Q3:</span> <span class="text-right font-semibold">${valueFormatter(boxPlotMetric, d.q3)}</span><span>Median:</span> <span class="text-right font-semibold">${valueFormatter(boxPlotMetric, d.median)}</span><span>Q1:</span> <span class="text-right font-semibold">${valueFormatter(boxPlotMetric, d.q1)}</span><span>Min:</span> <span class="text-right font-semibold">${valueFormatter(boxPlotMetric, d.min)}</span></div>`);
            positionTooltip(event);
        }).on('mouseleave', function () {
            const group = d3.select(this);
            group.select('.box').transition().duration(150).attr('fill', themeColors.fill).attr('stroke', themeColors.stroke);
            group.select('.median-line').transition().duration(150).attr('stroke', themeColors.median);
            tooltip.style('opacity', 0).style('display', 'none');
        });

  }, [data, xDomain, yDomain, themeColors, boxPlotMetric, dimensions]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} />
      <div
        ref={tooltipRef}
        className="absolute p-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg pointer-events-none"
        style={{ opacity: 0, display: 'none', transition: 'opacity 0.2s' }}
      />
    </div>
  );
};

export default BoxPlot;