// charts.js
import { ERROR_MESSAGES } from './config.js';

/**
 * Creates an SVG element with specified attributes
 * @param {string} tag - SVG element tag
 * @param {Object} attributes - Element attributes
 * @returns {SVGElement} - Created SVG element
 */
function createSVGElement(tag, attributes = {}) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    return element;
}

/**
 * Adds a tooltip to an SVG element
 * @param {SVGElement} element - The element to add tooltip to
 * @param {string} text - Tooltip text
 * @param {SVGElement} parentGroup - Parent group to add tooltip to
 */
function addTooltip(element, text, parentGroup) {
    if (!element || !text || !parentGroup) return;

    let tooltip = null;

    element.addEventListener('mouseenter', () => {
        tooltip = createSVGElement('text', {
            'class': 'chart-tooltip',
            'x': element.cx ? element.cx.baseVal.value + 10 : element.x.baseVal.value + 10,
            'y': element.cy ? element.cy.baseVal.value - 5 : element.y.baseVal.value - 5,
            'fill': '#000',
            'font-size': '12'
        });
        tooltip.textContent = text;
        parentGroup.appendChild(tooltip);
    });

    element.addEventListener('mouseleave', () => {
        if (tooltip && tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    });
}

/**
 * Draws a radar chart for skills visualization
 * @param {HTMLElement} container - DOM container element
 * @param {Array} data - Skills data
 */
export function drawSkillsRadarChart(container, data = []) {
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.textContent = ERROR_MESSAGES.NO_DATA;
        return;
    }

    const skills = data
        .filter(item => item.type?.startsWith('skill_'))
        .map(item => ({
            name: item.type.replace('skill_', '').replace('-', ' '),
            value: item.amount
        }));

    if (skills.length === 0) {
        container.textContent = ERROR_MESSAGES.NO_DATA;
        return;
    }

    // Chart dimensions and configuration
    const width = 500, height = 500;
    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
    const radius = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom) / 2;
    const numAxes = skills.length;
    const angleSlice = (Math.PI * 2) / numAxes;
    const maxValue = Math.max(...skills.map(s => s.value), 10);

    // Create SVG
    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'xMidYMid meet',
        class: 'chart-svg'
    });

    const chartGroup = createSVGElement('g', {
        transform: `translate(${width / 2}, ${height / 2})`
    });
    svg.appendChild(chartGroup);

    // Draw circular grid lines
    const levels = 5;
    for (let level = 1; level <= levels; level++) {
        const levelFactor = radius * (level / levels);
        const levelGroup = createSVGElement('g');

        // Draw polygon for this level
        const polygon = createSVGElement('polygon', {
            points: Array.from({ length: numAxes }, (_, i) => {
                const angle = i * angleSlice - Math.PI / 2;
                const x = levelFactor * Math.cos(angle);
                const y = levelFactor * Math.sin(angle);
                return `${x},${y}`;
            }).join(' '),
            stroke: '#ddd',
            fill: 'none'
        });
        levelGroup.appendChild(polygon);

        // Add level label
        const label = createSVGElement('text', {
            x: 0,
            y: -levelFactor - 5,
            'text-anchor': 'middle',
            fill: '#666',
            'font-size': '10'
        });
        label.textContent = Math.round((maxValue / levels) * level);
        levelGroup.appendChild(label);

        chartGroup.appendChild(levelGroup);
    }

    // Draw axes
    for (let i = 0; i < numAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const line = createSVGElement('line', {
            x1: 0,
            y1: 0,
            x2: radius * Math.cos(angle),
            y2: radius * Math.sin(angle),
            stroke: '#999',
            'stroke-width': '1'
        });
        chartGroup.appendChild(line);
    }

    // Draw skill labels
    for (let i = 0; i < numAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const labelRadius = radius + 20;
        const x = labelRadius * Math.cos(angle);
        const y = labelRadius * Math.sin(angle);

        const label = createSVGElement('text', {
            x: x,
            y: y,
            'text-anchor': 'middle',
            fill: '#333',
            'font-size': '12'
        });

        if (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) {
            label.setAttribute('text-anchor', 'end');
        }

        label.textContent = skills[i].name;
        chartGroup.appendChild(label);
    }

    // Draw the radar shape
    const radarPoints = skills.map((_, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        const value = skills[i].value;
        const scaledValue = (value / maxValue) * radius;
        const x = scaledValue * Math.cos(angle);
        const y = scaledValue * Math.sin(angle);
        return `${x},${y}`;
    }).join(' ');

    const radar = createSVGElement('polygon', {
        points: radarPoints,
        fill: 'rgba(75, 192, 192, 0.4)',
        stroke: 'rgba(75, 192, 192, 1)',
        'stroke-width': '2'
    });
    chartGroup.appendChild(radar);

    // Add dots at each data point
    skills.forEach((skill, i) => {
        const angle = i * angleSlice - Math.PI / 2;
        const scaledValue = (skill.value / maxValue) * radius;
        const x = scaledValue * Math.cos(angle);
        const y = scaledValue * Math.sin(angle);

        const dot = createSVGElement('circle', {
            cx: x,
            cy: y,
            r: 4,
            fill: 'rgba(75, 192, 192, 1)',
            stroke: '#fff',
            'stroke-width': '1'
        });

        addTooltip(dot, `${skill.name}: ${skill.value}`, chartGroup);
        chartGroup.appendChild(dot);
    });

    // Add chart title
    const title = createSVGElement('text', {
        x: 0,
        y: -radius - margin.top + 20,
        'text-anchor': 'middle',
        'font-size': '16',
        fill: '#333'
    });
    title.textContent = 'Skills Radar Chart';
    chartGroup.appendChild(title);

    container.appendChild(svg);
}

/**
 * Draws a line chart for XP progress visualization
 * @param {HTMLElement} container - DOM container element
 * @param {Array} data - XP progress data
 */
export function drawXpProgressLineChart(container, data = []) {
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.textContent = ERROR_MESSAGES.NO_DATA;
        return;
    }

    // Chart dimensions and configuration
    const width = 600, height = 300;
    const margin = { top: 20, right: 30, bottom: 60, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Calculate scales
    const xMax = data.length > 1 ? data.length - 1 : 1;
    const yMax = Math.max(...data.map(d => d.totalXp)) / 1000000; // Convert to MB

    const xScale = index => (index / xMax) * innerWidth;
    const yScale = valueMB => innerHeight - (valueMB / yMax) * innerHeight;

    // Create SVG
    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'xMidYMid meet',
        class: 'chart-svg'
    });

    const chartGroup = createSVGElement('g', {
        transform: `translate(${margin.left}, ${margin.top})`
    });
    svg.appendChild(chartGroup);

    // Draw X-axis line
    const xAxisLine = createSVGElement('line', {
        x1: 0,
        y1: innerHeight,
        x2: innerWidth,
        y2: innerHeight,
        stroke: '#ccc'
    });
    chartGroup.appendChild(xAxisLine);

    // Draw Y-axis line
    const yAxisLine = createSVGElement('line', {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: innerHeight,
        stroke: '#ccc'
    });
    chartGroup.appendChild(yAxisLine);

    // Draw X-axis labels
    const numLabels = Math.min(data.length, 5);
    for (let i = 0; i < numLabels; i++) {
        const index = Math.floor(i * (data.length - 1) / (numLabels - 1));
        const xPos = xScale(index);
        const text = createSVGElement('text', {
            x: xPos,
            y: innerHeight + 10,
            'text-anchor': 'end',
            transform: `rotate(-45 ${xPos}, ${innerHeight + 10})`,
            fill: '#333',
            'font-size': '10'
        });
        text.textContent = data[index].date;
        chartGroup.appendChild(text);
    }

    // X-axis title
    const xAxisTitle = createSVGElement('text', {
        x: innerWidth / 2,
        y: height - margin.top - 5,
        'text-anchor': 'middle',
        fill: '#333',
        'font-size': '12'
    });
    xAxisTitle.textContent = 'Date';
    chartGroup.appendChild(xAxisTitle);

    // Draw Y-axis labels (in MB)
    const numYLabels = 5;
    for (let i = 0; i <= numYLabels; i++) {
        const valueMB = (yMax / numYLabels) * i;
        const yPos = yScale(valueMB);
        const text = createSVGElement('text', {
            x: -5,
            y: yPos + 3,
            'text-anchor': 'end',
            fill: '#333',
            'font-size': '10'
        });
        text.textContent = `${valueMB.toFixed(2)} MB`;
        chartGroup.appendChild(text);
    }

    // Y-axis title
    const yAxisTitle = createSVGElement('text', {
        x: -margin.left + 15,
        y: innerHeight / 2,
        'text-anchor': 'middle',
        transform: `rotate(-90 -${margin.left - 15}, ${innerHeight / 2})`,
        fill: '#333',
        'font-size': '12'
    });
    yAxisTitle.textContent = 'Project XP (MB)';
    chartGroup.appendChild(yAxisTitle);

    // Draw the line path
    if (data.length > 1) {
        let pathData = `M ${xScale(0)},${yScale(data[0].totalXp / 1000000)}`;
        for (let i = 1; i < data.length; i++) {
            pathData += ` L ${xScale(i)},${yScale(data[i].totalXp / 1000000)}`;
        }

        const path = createSVGElement('path', {
            d: pathData,
            fill: 'none',
            stroke: '#60a5fa',
            'stroke-width': '2',
            class: 'chart-line'
        });
        chartGroup.appendChild(path);
    } else if (data.length === 1) {
        // Single point case
        const singlePoint = createSVGElement('circle', {
            cx: xScale(0),
            cy: yScale(data[0].totalXp / 1000000),
            r: 5,
            fill: '#60a5fa',
            stroke: '#fff',
            'stroke-width': '2'
        });
        chartGroup.appendChild(singlePoint);
    }

    // Add data points with tooltips
    data.forEach((d, i) => {
        const circle = createSVGElement('circle', {
            cx: xScale(i),
            cy: yScale(d.totalXp / 1000000),
            r: 3,
            fill: '#60a5fa',
            stroke: '#fff',
            'stroke-width': '1',
            class: 'chart-point'
        });

        addTooltip(circle, `Date: ${d.date}, XP: ${d.totalXpMB} MB`, chartGroup);
        chartGroup.appendChild(circle);
    });

    // Add chart title
    const title = createSVGElement('text', {
        x: width / 2,
        y: margin.top / 2 + 5,
        'text-anchor': 'middle',
        'font-size': '16',
        fill: '#333'
    });
    title.textContent = 'Project XP Progress Over Time';
    svg.appendChild(title);

    container.appendChild(svg);
}

/**
 * Draws a bar chart for XP by project visualization
 * @param {HTMLElement} container - DOM container element
 * @param {Object} data - XP by project data
 */
export function drawXpByProjectBarChart(container, data = {}) {
    if (!container) return;
    container.innerHTML = '';

    const projects = Object.keys(data).sort((a, b) => data[b] - data[a]);
    if (projects.length === 0) {
        container.textContent = ERROR_MESSAGES.NO_DATA;
        return;
    }

    // Limit to top 10 projects to avoid clutter
    const displayProjects = projects.slice(0, 10);
    const displayData = displayProjects.map(proj => ({
        name: proj,
        xp: data[proj]
    }));

    // Chart dimensions and configuration
    const width = 600, height = 300;
    const margin = { top: 20, right: 30, bottom: 100, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create SVG
    const svg = createSVGElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'xMidYMid meet',
        class: 'chart-svg'
    });

    const chartGroup = createSVGElement('g', {
        transform: `translate(${margin.left}, ${margin.top})`
    });
    svg.appendChild(chartGroup);

    // Scales
    const xBandWidth = innerWidth / Math.max(displayProjects.length, 1);
    const yMax = Math.max(...displayData.map(d => d.xp));

    const xScale = index => index * xBandWidth;
    const yScale = value => innerHeight - (value / yMax) * innerHeight;

    // Draw bars
    displayData.forEach((d, i) => {
        const barHeight = innerHeight - yScale(d.xp);
        const bar = createSVGElement('rect', {
            x: xScale(i) + xBandWidth * 0.1,
            y: yScale(d.xp),
            width: xBandWidth * 0.8,
            height: barHeight,
            fill: '#4ade80',
            rx: 3,
            ry: 3,
            class: 'chart-bar'
        });

        addTooltip(bar, `${d.name}: ${d.xp} XP`, chartGroup);
        chartGroup.appendChild(bar);

        // Add XP value label above bar
        const text = createSVGElement('text', {
            x: xScale(i) + xBandWidth / 2,
            y: yScale(d.xp) - 5,
            'text-anchor': 'middle',
            fill: '#333',
            'font-size': '10'
        });
        text.textContent = d.xp;
        chartGroup.appendChild(text);
    });

    // Draw X-axis line
    const xAxisLine = createSVGElement('line', {
        x1: 0,
        y1: innerHeight,
        x2: innerWidth,
        y2: innerHeight,
        stroke: '#ccc'
    });
    chartGroup.appendChild(xAxisLine);

    // Draw X-axis labels (project names)
    displayProjects.forEach((proj, i) => {
        const xPos = xScale(i) + xBandWidth / 2;
        const text = createSVGElement('text', {
            x: xPos,
            y: innerHeight + 10,
            'text-anchor': 'end',
            transform: `rotate(-45 ${xPos}, ${innerHeight + 10})`,
            fill: '#333',
            'font-size': '10'
        });
        text.textContent = proj;
        chartGroup.appendChild(text);
    });

    // X-axis title
    const xAxisTitle = createSVGElement('text', {
        x: innerWidth / 2,
        y: height - margin.top - 5,
        'text-anchor': 'middle',
        fill: '#333',
        'font-size': '12'
    });
    xAxisTitle.textContent = 'Project';
    chartGroup.appendChild(xAxisTitle);

    // Draw Y-axis line
    const yAxisLine = createSVGElement('line', {
        x1: 0,
        y1: 0,
        x2: 0,
        y2: innerHeight,
        stroke: '#ccc'
    });
    chartGroup.appendChild(yAxisLine);

    // Draw Y-axis labels
    const numYLabels = 5;
    for (let i = 0; i <= numYLabels; i++) {
        const value = (yMax / numYLabels) * i;
        const yPos = yScale(value);
        const text = createSVGElement('text', {
            x: -5,
            y: yPos + 3,
            'text-anchor': 'end',
            fill: '#333',
            'font-size': '10'
        });
        text.textContent = Math.round(value);
        chartGroup.appendChild(text);
    }

    // Y-axis title
    const yAxisTitle = createSVGElement('text', {
        x: -margin.left + 15,
        y: innerHeight / 2,
        'text-anchor': 'middle',
        transform: `rotate(-90 -${margin.left - 15}, ${innerHeight / 2})`,
        fill: '#333',
        'font-size': '12'
    });
    yAxisTitle.textContent = 'XP Amount';
    chartGroup.appendChild(yAxisTitle);

    // Add chart title
    const title = createSVGElement('text', {
        x: width / 2,
        y: margin.top / 2 + 5,
        'text-anchor': 'middle',
        'font-size': '16',
        fill: '#333'
    });
    title.textContent = 'XP Earned by Project (Top 10)';
    svg.appendChild(title);

    container.appendChild(svg);
}