import React, { useRef, useEffect, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { StackedBarChartDataPoint, PRICE_CATEGORIES, PriceCategory, StackedBarChartMode } from '../types.ts';
import { formatMonthYear } from '../utils/formatters.ts';

interface StackedBarChartProps {
  data: StackedBarChartDataPoint[];
  xDomain: string[];
  theme: 'light' | 'dark';
  mode: StackedBarChartMode;
  yDomain: [number, number]; // Y-domain for 'count' mode
}

// A vibrant, sequential color palette for price categories
const colorMapping: Record<PriceCategory, string> = {
  '>=1m': '#d946ef',    // fuchsia-500
  '800k-1m': '#8b5cf6',   // violet-500
  '500-800k': '#6366f1',  // indigo-500
  '300-500k': '#3b82f6',  // blue-500
  '0-300k': '#38bdf8',    // sky-400
};

const StackedBarChart: React.FC<StackedBarChartProps> = ({ data, xDomain, theme, mode, yDomain }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const chartElementsRef = useRef<{
    g?: d3.Selection<SVGGElement, unknown, null, undefined>;
    xAxis?: d3.Selection<SVGGElement, unknown, null, undefined>;
    yAxis?: d3.Selection<SVGGElement, unknown, null, undefined>;
    grid?: d3.Selection<SVGGElement, unknown, null, undefined>;
    legend?: d3.Selection<SVGGElement, unknown, null, undefined>;
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

  const processedData = useMemo(() => {
    if (mode === 'percentage') {
      return data.map(d => {
        const item: any = { month: d.month };
        PRICE_CATEGORIES.forEach(category => {
          item[category] = d.totalTransactions > 0 ? (d[category] / d.totalTransactions) * 100 : 0;
        });
        return item;
      });
    }
    // For count mode, just use the raw counts.
    return data;
  }, [data, mode]);

  // One-time setup
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const margin = { top: 60, right: 20, bottom: 50, left: 50 };
    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    chartElementsRef.current = {
      g,
      grid: g.append('g').attr('class', 'grid').attr('pointer-events', 'none'),
      xAxis: g.append('g').attr('class', 'x-axis'),
      yAxis: g.append('g').attr('class', 'y-axis'),
      legend: svg.append('g').attr('class', 'legend'),
    };

  }, []);

  // Update chart
  useEffect(() => {
    if (!containerRef.current || !tooltipRef.current || !chartElementsRef.current.g || dimensions.width === 0) return;

    const { g, xAxis, yAxis, grid, legend } = chartElementsRef.current;
    
    const { width, height } = dimensions;
    const margin = { top: 60, right: 20, bottom: 50, left: 50 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    
    const isPercentageMode = mode === 'percentage';
    const strokeColor = isDarkMode ? '#1e293b' : '#f8fafc'; // slate-800, slate-50
    
    d3.select(svgRef.current).attr('width', width).attr('height', height);
    g.attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    const stackGenerator = d3.stack<any, PriceCategory>()
      .keys(PRICE_CATEGORIES);

    const series = stackGenerator(processedData);

    const x = d3.scaleBand().range([0, innerWidth]).domain(xDomain).padding(0.2);
    const y = d3.scaleLinear()
      .domain(isPercentageMode ? [0, 100] : yDomain)
      .range([innerHeight, 0]);
    
    // Axes & Grid
    const numMonths = xDomain.length;
    let tickValues: string[];
    if (numMonths > 36) tickValues = xDomain.filter((_, i) => i % 6 === 0);
    else if (numMonths > 24) tickValues = xDomain.filter((_, i) => i % 3 === 0);
    else if (numMonths > 12) tickValues = xDomain.filter((_, i) => i % 2 === 0);
    else tickValues = xDomain;

    if (numMonths > 0 && !tickValues.includes(xDomain[xDomain.length - 1])) {
        tickValues.push(xDomain[xDomain.length - 1]);
    }
    
    const xAxisGenerator = d3.axisBottom(x).tickValues(tickValues).tickFormat(d => {
        const date = new Date(`${d}-01T12:00:00Z`);
        if (date.getMonth() === 0 || numMonths > 12) return d3.timeFormat('%b \'%y')(date);
        return d3.timeFormat('%b')(date);
    }).tickSizeOuter(0);

    xAxis?.attr('transform', `translate(0, ${innerHeight})`).transition().duration(500).call(xAxisGenerator)
      .call(s => s.select(".domain").remove())
      .selectAll(".tick text").style("font-weight", "600").style("font-size", "11px");

    if (isPercentageMode) {
      const yAxisTicks = [0, 25, 50, 75, 100];
      const yAxisHighlightColor = isDarkMode ? '#f1f5f9' : '#1e293b'; // slate-100, slate-800
      const fiftyPercentLineColor = isDarkMode ? '#475569' : '#cbd5e1'; // slate-600, slate-300

      yAxis?.transition().duration(500)
        .call(d3.axisLeft(y).tickValues(yAxisTicks).tickFormat(d => `${d}%`))
        .call(s => s.selectAll(".domain, line").remove())
        .call(s => s.selectAll('.tick text')
            .style('font-weight', (d: any) => d === 50 ? 'bold' : 'normal')
            .style('fill', (d: any) => d === 50 ? yAxisHighlightColor : 'currentColor')
        );

      grid?.lower().transition().duration(500)
        .call(d3.axisLeft(y).tickValues(yAxisTicks).tickSize(-innerWidth).tickFormat(() => ""))
        .call(s => s.select(".domain").remove())
        .selectAll("line")
        .attr('stroke', (d: any) => d === 50 ? fiftyPercentLineColor : 'currentColor')
        .attr('stroke-opacity', (d: any) => d === 50 ? 1 : 0.1)
        .attr('stroke-dasharray', (d: any) => d === 50 ? null : '2,2')
        .attr('stroke-width', (d: any) => d === 50 ? 2 : 1);
    } else { // Count mode
      yAxis?.transition().duration(500)
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",.0f")))
        .call(s => s.selectAll(".domain, line").remove());

      grid?.lower().transition().duration(500)
        .call(d3.axisLeft(y).ticks(5).tickSize(-innerWidth).tickFormat(() => ""))
        .call(s => s.select(".domain").remove())
        .selectAll("line")
        .attr('stroke', 'currentColor')
        .attr('stroke-opacity', 0.1)
        .attr('stroke-dasharray', '2,2')
        .attr('stroke-width', 1);
    }
      
    // Tooltip
    const tooltip = d3.select(tooltipRef.current);
    const positionTooltip = (event: MouseEvent) => {
        const tooltipNode = tooltip.node() as HTMLElement;
        const containerNode = containerRef.current;
        if (!tooltipNode || !containerNode) return;
        
        const { width: tooltipWidth, height: tooltipHeight } = tooltipNode.getBoundingClientRect();
        const containerRect = containerNode.getBoundingClientRect();
        const offset = 15;
        const margin = 8;

        let left = event.clientX - containerRect.left - tooltipWidth / 2;
        left = Math.max(margin, Math.min(left, containerRect.width - tooltipWidth - margin));

        const spaceAbove = event.clientY - containerRect.top;
        let top = (spaceAbove > tooltipHeight + offset) 
            ? event.clientY - containerRect.top - tooltipHeight - offset
            : event.clientY - containerRect.top + offset;
        
        tooltip.style('left', `${left}px`).style('top', `${top}px`);
    };

    // Bars
    g.selectAll('.bar-series').data(series, (d:any) => d.key)
        .join('g').attr('class', 'bar-series')
        .attr('fill', d => colorMapping[d.key as PriceCategory])
        .selectAll('rect').data(d => d)
        .join(
            enter => enter.append('rect')
                .attr('y', innerHeight).attr('height', 0),
            update => update,
            exit => exit.transition().duration(200).attr('y', innerHeight).attr('height', 0).remove()
        )
        .attr('x', d => x(d.data.month)!)
        .attr('width', x.bandwidth())
        .attr('stroke', strokeColor)
        .attr('stroke-width', 1)
        .on('mouseover', function(event, d) {
            tooltip.style('opacity', 1).style('display', 'block');
            d3.select(this).style('filter', 'brightness(1.2)');
        })
        .on('mousemove', function(event, d) {
            // FIX: Cast 'this' to SVGRectElement to address TypeScript error regarding 'parentNode' property.
            const seriesDatum = d3.select((this as SVGRectElement).parentNode as SVGGElement).datum() as d3.Series<any, PriceCategory>;
            const hoveredCategory = seriesDatum.key;
            const originalMonthData = data.find(item => item.month === d.data.month);
            
            let tooltipContent = `<div class="font-bold text-center mb-1 pb-1 border-b border-slate-200 dark:border-slate-600">${formatMonthYear(d.data.month)}</div>
            <div class="grid grid-cols-[auto,1fr,auto] gap-x-2 items-center text-xs mt-2">`;
            
            PRICE_CATEGORIES.slice().reverse().forEach(cat => {
                const isHovered = cat === hoveredCategory;
                const highlightClass = isHovered ? 'font-bold text-indigo-500 dark:text-indigo-300' : '';
                const value = isPercentageMode
                    ? `${(d.data[cat] as number).toFixed(2)}%`
                    : d3.format(',.0f')(d.data[cat] as number);

                tooltipContent += `
                    <div class="w-3 h-3 rounded-sm" style="background-color:${colorMapping[cat]}"></div>
                    <span class="font-medium text-slate-600 dark:text-slate-300 ${highlightClass}">${cat}</span>
                    <span class="text-right font-semibold ${highlightClass}">${value}</span>
                `;
            });
            if (originalMonthData) {
              tooltipContent += `<span class="col-span-3 my-1 border-t border-slate-200 dark:border-slate-600"></span>
              <span></span><span class="font-bold">Total</span><span class="text-right font-bold">${d3.format(",.0f")(originalMonthData.totalTransactions)}</span>`
            }
            tooltipContent += `</div>`;
            tooltip.html(tooltipContent);
            positionTooltip(event);
        })
        .on('mouseleave', function() {
            tooltip.style('opacity', 0).style('display', 'none');
            d3.select(this).style('filter', null);
        })
        .transition().duration(500)
        .attr('y', d => y(d[1]))
        .attr('height', d => Math.max(0, y(d[0]) - y(d[1])))
        .attr('rx', function() {
            // FIX: Cast 'this' to SVGRectElement to address TypeScript error regarding 'parentNode' property.
            const seriesDatum = d3.select((this as SVGRectElement).parentNode as SVGGElement).datum() as d3.Series<any, PriceCategory>;
            return seriesDatum.key === '>=1m' ? 4 : 0;
        })
        .attr('ry', function() {
            // FIX: Cast 'this' to SVGRectElement to address TypeScript error regarding 'parentNode' property.
            const seriesDatum = d3.select((this as SVGRectElement).parentNode as SVGGElement).datum() as d3.Series<any, PriceCategory>;
            return seriesDatum.key === '>=1m' ? 4 : 0;
        });

    // Legend
    const legendData = PRICE_CATEGORIES.slice().reverse();
    const legendItems = legend?.selectAll('.legend-item').data(legendData);

    const joinedLegendItems = legendItems?.join(
        enter => {
            const item = enter.append('g').attr('class', 'legend-item');
            item.append('rect').attr('width', 12).attr('height', 12).attr('rx', 3);
            item.append('text').attr('x', 18).attr('y', 10)
                .style('font-size', '12px')
                .style('fill', 'currentColor');
            return item;
        },
        update => update
    );
    joinedLegendItems?.select('rect').attr('fill', d => colorMapping[d]);
    joinedLegendItems?.select('text').text(d => d);

    let cumulativeWidth = 0;
    const legendPadding = 24;
    joinedLegendItems?.attr('transform', function() {
        const transform = `translate(${cumulativeWidth}, 0)`;
        const textNode = d3.select(this).select('text').node();
        if (textNode instanceof SVGGraphicsElement) {
            const itemWidth = 12 + 6 + textNode.getBBox().width + legendPadding;
            cumulativeWidth += itemWidth;
        }
        return transform;
    });

    const totalLegendWidth = cumulativeWidth > 0 ? cumulativeWidth - legendPadding : 0;
    legend?.attr('transform', `translate(${(width - totalLegendWidth) / 2}, ${margin.top / 2 - 5})`);

  }, [data, processedData, xDomain, isDarkMode, dimensions, mode, yDomain]);

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

export default StackedBarChart;
