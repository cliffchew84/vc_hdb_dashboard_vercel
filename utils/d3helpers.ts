import React from 'react';

/**
 * Calculates the optimal tick values for a date-based X-axis.
 * @param xDomain An array of month strings (e.g., "2023-01").
 * @returns A filtered array of strings to be used as tick values.
 */
export const calculateXAxisTicks = (xDomain: string[]): string[] => {
    const numMonths = xDomain.length;
    if (numMonths === 0) return [];

    let tickValues: string[];

    if (numMonths > 36) { // > 3 years, show every 6 months
        tickValues = xDomain.filter((_, i) => i % 6 === 0);
    } else if (numMonths > 24) { // > 2 years, show quarterly
        tickValues = xDomain.filter((_, i) => i % 3 === 0);
    } else if (numMonths > 12) { // > 1 year, show every other month
        tickValues = xDomain.filter((_, i) => i % 2 === 0);
    } else { // <= 1 year, show all months
        tickValues = xDomain;
    }

    // Ensure the last month is always a tick to clearly show the end of the range.
    if (!tickValues.includes(xDomain[xDomain.length - 1])) {
        tickValues.push(xDomain[xDomain.length - 1]);
    }
    
    return tickValues;
};


/**
 * Positions a D3-controlled tooltip element relative to a mouse event within a container.
 * @param event The mouse event from D3.
 * @param tooltipRef A React ref to the tooltip's HTML element.
 * @param containerRef A React ref to the chart container's HTML element.
 */
export const positionD3Tooltip = (
    event: MouseEvent,
    tooltipRef: React.RefObject<HTMLElement>,
    containerRef: React.RefObject<HTMLElement>
) => {
    const tooltipNode = tooltipRef.current;
    const containerNode = containerRef.current;
    if (!tooltipNode || !containerNode) return;

    const { width: tooltipWidth, height: tooltipHeight } = tooltipNode.getBoundingClientRect();
    const containerRect = containerNode.getBoundingClientRect();
    
    const offset = 15; // Vertical distance from cursor
    const margin = 10; // Horizontal distance from container edges

    // Center tooltip horizontally on cursor
    let left = event.clientX - containerRect.left - tooltipWidth / 2;
    // Clamp left position to stay within container bounds
    left = Math.max(margin, Math.min(left, containerRect.width - tooltipWidth - margin));

    // Position tooltip above cursor
    let top = event.clientY - containerRect.top - tooltipHeight - offset;
    // If not enough space above, position below cursor
    if (top < margin) {
        top = event.clientY - containerRect.top + offset;
    }

    tooltipNode.style.left = `${left}px`;
    tooltipNode.style.top = `${top}px`;
};
