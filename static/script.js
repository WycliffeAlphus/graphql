// script.js

// Constants for GraphQL API and Auth endpoint
const GRAPHQL_ENDPOINT = 'https://learn.zone01kisumu.ke/api/graphql-engine/v1/graphql';
const SIGNIN_ENDPOINT = 'https://learn.zone01kisumu.ke/api/auth/signin';

// DOM Elements
const loginSection = document.getElementById('login-section');
const fixedHeaderContainer = document.getElementById('fixed-header-container'); // New DOM element
const profileContentScrollArea = document.getElementById('profile-content-scroll-area'); // Renamed
const loginForm = document.getElementById('login-form');
const usernameEmailInput = document.getElementById('username-email');
const passwordInput = document.getElementById('password');
const errorMessageDiv = document.getElementById('error-message');

/**
 * Displays an error message to the user.
 * @param {string} message - The error message to display.
 */
function displayErrorMessage(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.style.display = 'block';
}

/**
 * Hides the error message.
 */
function hideErrorMessage() {
    errorMessageDiv.textContent = '';
    errorMessageDiv.style.display = 'none';
}

/**
 * Handles the user login process.
 * @param {Event} event - The form submission event.
 */
async function handleLogin(event) {
    event.preventDefault(); // Prevent default form submission

    hideErrorMessage(); // Clear previous errors

    const usernameEmail = usernameEmailInput.value;
    const password = passwordInput.value;

    // Basic Authentication: base64 encode "username:password"
    const credentials = btoa(`${usernameEmail}:${password}`);

    try {
        const response = await fetch(SIGNIN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json' // Often required even for Basic Auth
            },
            body: JSON.stringify({}) // Sending an empty JSON object as body
        });

        if (!response.ok) {
            // Check for specific error messages from the server
            const errorText = await response.text(); // Get raw text to check for messages
            console.error('Login failed:', response.status, errorText);
            if (response.status === 401) {
                displayErrorMessage('Invalid username/email or password.');
            } else {
                displayErrorMessage(`Login failed: ${errorText || response.statusText}`);
            }
            return;
        }

        let jwtToken = await response.text(); // Get the raw text response, which is the JWT

        // Remove any surrounding double quotes from the JWT string (fix for previous issue)
        jwtToken = jwtToken.replace(/^"|"$/g, '');

        if (jwtToken) {
            try {
                localStorage.setItem('jwtToken', jwtToken); // Store JWT
                console.log('Login successful! JWT stored.');
                console.log('Stored JWT (first 50 chars):', jwtToken.substring(0, 50) + '...');
                console.log('Stored JWT length:', jwtToken.length);
            } catch (storageError) {
                console.error('Error storing JWT in localStorage:', storageError);
                displayErrorMessage('Failed to save session. Please try again.');
                return;
            }
            loadProfilePage(); // Load the profile page
        } else {
            displayErrorMessage('Login successful but no JWT token received.');
            console.error('No JWT token received in login response (empty string or null):', jwtToken);
        }

    } catch (error) {
        console.error('Network or unexpected error during login:', error);
        displayErrorMessage('An unexpected error occurred. Please try again later.');
    }
}

/**
 * Clears the JWT token and redirects to the login page.
 */
function logout() {
    localStorage.removeItem('jwtToken');
    console.log('Logged out. JWT removed.');
    // Hide profile sections, show login section
    fixedHeaderContainer.style.display = 'none';
    fixedHeaderContainer.innerHTML = '';
    profileContentScrollArea.style.display = 'none';
    profileContentScrollArea.innerHTML = ''; // Clear profile content
    loginSection.style.display = 'flex'; // Or 'block' depending on its original display
    usernameEmailInput.value = ''; // Clear form fields
    passwordInput.value = '';
    hideErrorMessage();
}

/**
 * Fetches data from the GraphQL endpoint.
 * @param {string} query - The GraphQL query string.
 * @returns {Promise<Object>} - The JSON data from the GraphQL response.
 */
async function fetchGraphQLData(query) {
    let jwtToken = null;
    try {
        jwtToken = localStorage.getItem('jwtToken');
    } catch (storageError) {
        console.error('Error retrieving JWT from localStorage:', storageError);
        displayErrorMessage('Failed to retrieve session. Please log in again.');
        logout();
        return null;
    }

    if (!jwtToken) {
        console.error('No JWT token found. Redirecting to login.');
        logout();
        return null;
    }

    console.log('JWT token being sent (first 50 chars):', jwtToken.substring(0, 50) + '...');
    console.log('JWT token length being sent:', jwtToken.length);


    try {
        const response = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ query })
        });

        if (!response.ok) {
            // If token is expired or invalid, handle appropriately
            if (response.status === 401 || response.status === 403) {
                console.error('Authentication error (401/403): Token expired or invalid.');
                displayErrorMessage('Session expired or invalid. Please log in again.');
                logout();
                return null;
            }
            const errorText = await response.text();
            throw new Error(`GraphQL network error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.errors) {
            console.error('GraphQL Errors:', data.errors);
            const errorMessage = data.errors.map(err => err.message).join('; ');
            displayErrorMessage(`Data fetching error: ${errorMessage}`);
            // Specific check for 'invalid-jwt' error for more targeted message
            if (data.errors.some(err => err.extensions?.code === 'invalid-jwt')) {
                displayErrorMessage('Your session is invalid. Please log in again. (Possible JWT corruption)');
                logout(); // Force logout if JWT is explicitly invalid
            }
            return null;
        }

        return data.data;
    } catch (error) {
        console.error('Error fetching GraphQL data:', error);
        displayErrorMessage('Failed to fetch data. Check console for details.');
        return null;
    }
}

/**
 * Calculates XP progress over time.
 * @param {Array} transactions - Array of transaction objects.
 * @returns {Array<{date: string, totalXp: number}>} - Array of objects with date and cumulative XP.
 */
function calculateXpProgress(transactions) {
    const xpTransactions = transactions
        .filter(t => t.type === 'xp' && t.object?.type === 'project') // Filter for project XP
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); // Sort by date

    let cumulativeXp = 0;
    const xpProgress = [];
    xpTransactions.forEach(tx => {
        cumulativeXp += tx.amount;
        xpProgress.push({
            date: new Date(tx.createdAt).toLocaleDateString(), // Or format as ISO 8601YYYY-MM-DD
            totalXp: cumulativeXp
        });
    });
    return xpProgress;
}

/**
 * Calculates XP earned per project.
 * @param {Array} transactions - Array of transaction objects.
 * @returns {Object<string, number>} - Object mapping project name to total XP.
 */
function calculateXpByProject(transactions) {
    const xpByProject = {};
    transactions
        .filter(t => t.type === 'xp' && t.object?.type === 'project')
        .forEach(tx => {
            const projectName = tx.object.name;
            if (projectName) {
                xpByProject[projectName] = (xpByProject[projectName] || 0) + tx.amount;
            }
        });
    return xpByProject;
}

// Removed calculateAuditRatio function as 'audited' field was not found.


/**
 * Calculates pass/fail counts for 'tester' type results.
 * @param {Array} results - Array of result objects.
 * @returns {{passed: number, failed: number, total: number}} - Counts of passed and failed exercises.
 */
function calculatePassFailCounts(results) {
    let passed = 0;
    let failed = 0;
    let totalTested = 0;

    results.forEach(res => {
        if (res.type === 'tester' && res.grade !== null) { // Ensure it's a tester result and grade exists
            totalTested++;
            if (res.grade === 1) {
                passed++;
            } else if (res.grade < 1 && res.grade >= 0) { // Consider any grade < 1 (but not negative) as a fail
                failed++;
            }
        }
    });

    return { passed, failed, total: totalTested };
}

/**
 * Draws an SVG radar chart for skills.
 * @param {HTMLElement} container - The SVG container element.
 * @param {Array<{type: string, amount: number}>} data - Array of skill objects.
 */
function drawSkillsRadarChart(container, data) {
    container.innerHTML = ''; // Clear previous SVG content
    if (!data || data.length === 0) {
        container.textContent = 'No skills data available for radar chart.';
        return;
    }

    // Filter out non-skill types and format data
    const skills = data
        .filter(item => item.type.startsWith('skill_'))
        .map(item => ({
            name: item.type.replace('skill_', '').replace('-', ' '),
            value: item.amount
        }));

    if (skills.length === 0) {
        container.textContent = 'No valid skill data found.';
        return;
    }

    const width = 500;
    const height = 500;
    const margin = { top: 60, right: 60, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const radius = Math.min(innerWidth, innerHeight) / 2;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'chart-svg');

    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', `translate(${width / 2}, ${height / 2})`);
    svg.appendChild(chartGroup);

    // Find max value for scaling
    const maxValue = Math.max(...skills.map(s => s.value), 10);

    // Number of axes (same as number of skills)
    const numAxes = skills.length;
    const angleSlice = (Math.PI * 2) / numAxes;

    // Draw circular grid lines
    const levels = 5;
    for (let level = 1; level <= levels; level++) {
        const levelFactor = radius * (level / levels);
        const levelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Draw polygon for this level
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        let points = '';
        for (let i = 0; i < numAxes; i++) {
            const angle = i * angleSlice - Math.PI / 2;
            const x = levelFactor * Math.cos(angle);
            const y = levelFactor * Math.sin(angle);
            points += `${x},${y} `;
        }
        polygon.setAttribute('points', points);
        polygon.setAttribute('stroke', '#ddd');
        polygon.setAttribute('fill', 'none');
        levelGroup.appendChild(polygon);
        
        // Add level label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', 0);
        label.setAttribute('y', -levelFactor - 5);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', '#666');
        label.setAttribute('font-size', '10');
        label.textContent = Math.round((maxValue / levels) * level);
        levelGroup.appendChild(label);
        chartGroup.appendChild(levelGroup);
    }

    // Draw axes
    for (let i = 0; i < numAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', radius * Math.cos(angle));
        line.setAttribute('y2', radius * Math.sin(angle));
        line.setAttribute('stroke', '#999');
        line.setAttribute('stroke-width', '1');
        chartGroup.appendChild(line);
    }

    // Draw skill labels
    for (let i = 0; i < numAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const labelRadius = radius + 20;
        const x = labelRadius * Math.cos(angle);
        const y = labelRadius * Math.sin(angle);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', x);
        label.setAttribute('y', y);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', '#333');
        label.setAttribute('font-size', '12');
        
        // Adjust label position for readability
        if (angle > Math.PI / 2 && angle < 3 * Math.PI / 2) {
            label.setAttribute('text-anchor', 'end');
        }
        
        label.textContent = skills[i].name;
        chartGroup.appendChild(label);
    }

    // Draw the radar shape
    const radar = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    let points = '';
    for (let i = 0; i < numAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const value = skills[i].value;
        const scaledValue = (value / maxValue) * radius;
        const x = scaledValue * Math.cos(angle);
        const y = scaledValue * Math.sin(angle);
        points += `${x},${y} `;
    }
    radar.setAttribute('points', points);
    radar.setAttribute('fill', 'rgba(75, 192, 192, 0.4)');
    radar.setAttribute('stroke', 'rgba(75, 192, 192, 1)');
    radar.setAttribute('stroke-width', '2');
    chartGroup.appendChild(radar);

    // Add dots at each data point
    for (let i = 0; i < numAxes; i++) {
        const angle = i * angleSlice - Math.PI / 2;
        const value = skills[i].value;
        const scaledValue = (value / maxValue) * radius;
        const x = scaledValue * Math.cos(angle);
        const y = scaledValue * Math.sin(angle);
        
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x);
        dot.setAttribute('cy', y);
        dot.setAttribute('r', 4);
        dot.setAttribute('fill', 'rgba(75, 192, 192, 1)');
        dot.setAttribute('stroke', '#fff');
        dot.setAttribute('stroke-width', '1');
        
        // Add tooltip on hover
        dot.addEventListener('mouseenter', () => {
            const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            tooltip.setAttribute('x', x + 10);
            tooltip.setAttribute('y', y - 10);
            tooltip.setAttribute('fill', '#000');
            tooltip.setAttribute('font-size', '12');
            tooltip.textContent = `${skills[i].name}: ${value}`;
            tooltip.setAttribute('class', 'chart-tooltip');
            chartGroup.appendChild(tooltip);
        });
        dot.addEventListener('mouseleave', () => {
            const tooltip = chartGroup.querySelector('.chart-tooltip');
            if (tooltip) tooltip.remove();
        });
        
        chartGroup.appendChild(dot);
    }

    // Add chart title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', 0);
    title.setAttribute('y', -radius - margin.top + 20);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '16');
    title.setAttribute('fill', '#333');
    chartGroup.appendChild(title);

    container.appendChild(svg);
}

/**
 * Draws an SVG line chart for XP progress over time.
 * @param {HTMLElement} container - The SVG container element.
 * @param {Array<{date: string, totalXp: number}>} data - Data points for the chart.
 */
function drawXpProgressLineChart(container, data) {
    container.innerHTML = ''; // Clear previous SVG content
    if (!data || data.length === 0) {
        container.textContent = 'No XP data available for line chart.';
        return;
    }

    const width = 600;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 60, left: 70 }; // Increased bottom for rotated labels
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - (margin.top + margin.bottom); // Correct calculation

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); // Maintain aspect ratio
    svg.setAttribute('class', 'chart-svg');

    // Create a group for chart content to apply margins
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
    svg.appendChild(chartGroup);

    // Calculate scales
    // Ensure xMax is at least 1 to prevent division by zero if only one data point
    const xMax = data.length > 1 ? Math.max(...data.map((d, i) => i)) : 1;
    const yMax = Math.max(...data.map(d => d.totalXp));

    const xScale = (index) => (index / xMax) * innerWidth;
    const yScale = (value) => innerHeight - (value / yMax) * innerHeight;

    // Draw X-axis line
    const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxisLine.setAttribute('x1', 0);
    xAxisLine.setAttribute('y1', innerHeight);
    xAxisLine.setAttribute('x2', innerWidth);
    xAxisLine.setAttribute('y2', innerHeight);
    xAxisLine.setAttribute('stroke', '#ccc');
    chartGroup.appendChild(xAxisLine);

    // Draw Y-axis line
    const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxisLine.setAttribute('x1', 0);
    yAxisLine.setAttribute('y1', 0);
    yAxisLine.setAttribute('x2', 0);
    yAxisLine.setAttribute('y2', innerHeight);
    yAxisLine.setAttribute('stroke', '#ccc');
    chartGroup.appendChild(yAxisLine);

    // Draw X-axis labels
    const numLabels = Math.min(data.length, 5); // Limit number of labels to avoid clutter
    for (let i = 0; i < numLabels; i++) {
        const index = Math.floor(i * (data.length - 1) / (numLabels - 1));
        const xPos = xScale(index);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', xPos);
        text.setAttribute('y', innerHeight + 10);
        text.setAttribute('text-anchor', 'end'); // Align to the end
        text.setAttribute('transform', `rotate(-45 ${xPos}, ${innerHeight + 10})`); // Rotate labels
        text.setAttribute('fill', '#333');
        text.setAttribute('font-size', '10');
        text.textContent = data[index].date;
        chartGroup.appendChild(text);
    }
    // X-axis title
    const xAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xAxisTitle.setAttribute('x', innerWidth / 2);
    xAxisTitle.setAttribute('y', height - margin.top - 5); // Adjusted position
    xAxisTitle.setAttribute('text-anchor', 'middle');
    xAxisTitle.setAttribute('fill', '#333');
    xAxisTitle.setAttribute('font-size', '12');
    xAxisTitle.textContent = 'Date';
    chartGroup.appendChild(xAxisTitle);

    // Draw Y-axis labels
    const numYLabels = 5;
    for (let i = 0; i <= numYLabels; i++) {
        const value = (yMax / numYLabels) * i;
        const yPos = yScale(value);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', -5);
        text.setAttribute('y', yPos + 3);
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('fill', '#333');
        text.setAttribute('font-size', '10');
        text.textContent = Math.round(value);
        chartGroup.appendChild(text);
    }
    // Y-axis title
    const yAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yAxisTitle.setAttribute('x', -margin.left + 15);
    yAxisTitle.setAttribute('y', innerHeight / 2);
    yAxisTitle.setAttribute('text-anchor', 'middle');
    yAxisTitle.setAttribute('transform', `rotate(-90 -${margin.left - 15}, ${innerHeight / 2})`);
    yAxisTitle.setAttribute('fill', '#333');
    yAxisTitle.setAttribute('font-size', '12');
    yAxisTitle.textContent = 'Total XP';
    chartGroup.appendChild(yAxisTitle);


    // Draw the line path (only if there are at least two points to form a line)
    if (data.length > 1) {
        let pathData = `M ${xScale(0)},${yScale(data[0].totalXp)}`;
        for (let i = 1; i < data.length; i++) {
            pathData += ` L ${xScale(i)},${yScale(data[i].totalXp)}`;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#60a5fa'); // Blue color
        path.setAttribute('stroke-width', '2');
        path.setAttribute('class', 'chart-line');
        chartGroup.appendChild(path);
    } else if (data.length === 1) {
        // If only one point, draw a circle at that point
        const singlePoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        singlePoint.setAttribute('cx', xScale(0));
        singlePoint.setAttribute('cy', yScale(data[0].totalXp));
        singlePoint.setAttribute('r', 5);
        singlePoint.setAttribute('fill', '#60a5fa');
        singlePoint.setAttribute('stroke', '#fff');
        singlePoint.setAttribute('stroke-width', '2');
        chartGroup.appendChild(singlePoint);
    }


    // Add circles for data points
    data.forEach((d, i) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', xScale(i));
        circle.setAttribute('cy', yScale(d.totalXp));
        circle.setAttribute('r', 3);
        circle.setAttribute('fill', '#60a5fa');
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '1');
        circle.setAttribute('data-xp', d.totalXp); // Store data for potential interactivity
        circle.setAttribute('data-date', d.date);
        circle.setAttribute('class', 'chart-point');
        chartGroup.appendChild(circle);

        // Optional: Add hover interactivity for circles
        circle.addEventListener('mouseenter', (event) => {
            const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            tooltip.setAttribute('x', event.target.cx.baseVal.value + 5);
            tooltip.setAttribute('y', event.target.cy.baseVal.value - 5);
            tooltip.setAttribute('fill', '#000');
            tooltip.setAttribute('font-size', '12');
            tooltip.textContent = `Date: ${d.date}, XP: ${d.totalXp}`;
            tooltip.setAttribute('class', 'chart-tooltip');
            chartGroup.appendChild(tooltip);
        });
        circle.addEventListener('mouseleave', () => {
            const tooltip = chartGroup.querySelector('.chart-tooltip');
            if (tooltip) tooltip.remove();
        });
    });

    // Add chart title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', margin.top / 2 + 5);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '16');
    title.setAttribute('fill', '#333');
    title.textContent = 'XP Progress Over Time';
    svg.appendChild(title);


    container.appendChild(svg);
}


/**
 * Draws an SVG bar chart for XP earned by project.
 * @param {HTMLElement} container - The SVG container element.
 * @param {Object<string, number>} data - Object mapping project name to total XP.
 */
function drawXpByProjectBarChart(container, data) {
    container.innerHTML = ''; // Clear previous SVG content
    const projects = Object.keys(data).sort((a, b) => data[b] - data[a]); // Sort by XP descending
    if (projects.length === 0) {
        container.textContent = 'No project XP data available for bar chart.';
        return;
    }

    // Limit to top N projects to avoid clutter
    const displayProjects = projects.slice(0, 10);
    const displayData = displayProjects.map(proj => ({ name: proj, xp: data[proj] }));

    const width = 600;
    const height = 300;
    const margin = { top: 20, right: 30, bottom: 100, left: 70 }; // Increased bottom for project names
    const innerWidth = width - (margin.left + margin.right); // Correct calculation
    const innerHeight = height - (margin.top + margin.bottom); // Correct calculation

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'chart-svg');

    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
    svg.appendChild(chartGroup);

    // Scales
    // Ensure displayProjects.length is at least 1 to prevent division by zero
    const xBandWidth = innerWidth / (displayProjects.length || 1);
    const yMax = Math.max(...displayData.map(d => d.xp)); // Max XP for scaling

    const xScale = (index) => index * xBandWidth;
    const yScale = (value) => innerHeight - (value / yMax) * innerHeight;

    // Draw bars
    displayData.forEach((d, i) => {
        const barHeight = innerHeight - yScale(d.xp);
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        bar.setAttribute('x', xScale(i) + xBandWidth * 0.1); // Add some padding
        bar.setAttribute('y', yScale(d.xp));
        bar.setAttribute('width', xBandWidth * 0.8);
        bar.setAttribute('height', barHeight);
        bar.setAttribute('fill', '#4ade80'); // Green color
        bar.setAttribute('rx', 3); // Rounded corners
        bar.setAttribute('ry', 3);
        bar.setAttribute('class', 'chart-bar');
        chartGroup.appendChild(bar);

        // Add XP value label above bar
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', xScale(i) + xBandWidth / 2);
        text.setAttribute('y', yScale(d.xp) - 5);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#333');
        text.setAttribute('font-size', '10');
        text.textContent = d.xp;
        chartGroup.appendChild(text);

        // Optional: Add hover interactivity for bars
        bar.addEventListener('mouseenter', (event) => {
            const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            tooltip.setAttribute('x', event.target.x.baseVal.value + event.target.width.baseVal.value / 2);
            tooltip.setAttribute('y', event.target.y.baseVal.value - 15);
            tooltip.setAttribute('fill', '#000');
            tooltip.setAttribute('font-size', '12');
            tooltip.setAttribute('text-anchor', 'middle');
            tooltip.textContent = `${d.name}: ${d.xp} XP`;
            tooltip.setAttribute('class', 'chart-tooltip');
            chartGroup.appendChild(tooltip);
        });
        bar.addEventListener('mouseleave', () => {
            const tooltip = chartGroup.querySelector('.chart-tooltip');
            if (tooltip) tooltip.remove();
        });
    });

    // Draw X-axis line
    const xAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxisLine.setAttribute('x1', 0);
    xAxisLine.setAttribute('y1', innerHeight);
    xAxisLine.setAttribute('x2', innerWidth);
    xAxisLine.setAttribute('y2', innerHeight);
    xAxisLine.setAttribute('stroke', '#ccc');
    chartGroup.appendChild(xAxisLine);

    // Draw X-axis labels (project names)
    displayProjects.forEach((proj, i) => {
        const xPos = xScale(i) + xBandWidth / 2;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', xPos);
        text.setAttribute('y', innerHeight + 10);
        text.setAttribute('text-anchor', 'end'); // Rotate from bottom-right of text
        text.setAttribute('transform', `rotate(-45 ${xPos}, ${innerHeight + 10})`);
        text.setAttribute('fill', '#333');
        text.setAttribute('font-size', '10');
        text.textContent = proj;
        chartGroup.appendChild(text);
    });
    // X-axis title
    const xAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    xAxisTitle.setAttribute('x', innerWidth / 2);
    xAxisTitle.setAttribute('y', height - margin.top - 5); // Adjusted position
    xAxisTitle.setAttribute('text-anchor', 'middle');
    xAxisTitle.setAttribute('fill', '#333');
    xAxisTitle.setAttribute('font-size', '12');
    xAxisTitle.textContent = 'Project';
    chartGroup.appendChild(xAxisTitle);


    // Draw Y-axis line
    const yAxisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxisLine.setAttribute('x1', 0);
    yAxisLine.setAttribute('y1', 0);
    yAxisLine.setAttribute('x2', 0);
    yAxisLine.setAttribute('y2', innerHeight);
    yAxisLine.setAttribute('stroke', '#ccc');
    chartGroup.appendChild(yAxisLine);

    // Draw Y-axis labels
    const numYLabels = 5;
    for (let i = 0; i <= numYLabels; i++) {
        const value = (yMax / numYLabels) * i;
        const yPos = yScale(value);
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', -5);
        text.setAttribute('y', yPos + 3);
        text.setAttribute('text-anchor', 'end');
        text.setAttribute('fill', '#333');
        text.setAttribute('font-size', '10');
        text.textContent = Math.round(value);
        chartGroup.appendChild(text);
    }
    // Y-axis title
    const yAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yAxisTitle.setAttribute('x', -margin.left + 15);
    yAxisTitle.setAttribute('y', innerHeight / 2);
    yAxisTitle.setAttribute('text-anchor', 'middle');
    yAxisTitle.setAttribute('transform', `rotate(-90 -${margin.left - 15}, ${innerHeight / 2})`);
    yAxisTitle.setAttribute('fill', '#333');
    yAxisTitle.setAttribute('font-size', '12');
    yAxisTitle.textContent = 'XP Amount';
    chartGroup.appendChild(yAxisTitle);

    // Add chart title
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', width / 2);
    title.setAttribute('y', margin.top / 2 + 5);
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '16');
    title.setAttribute('fill', '#333');
    title.textContent = 'XP Earned by Project (Top 10)';
    svg.appendChild(title);

    container.appendChild(svg);
}


/**
 * Queries user data from the GraphQL endpoint.
 * This query has been updated to remove the problematic 'audits' field with 'audited' and 'auditor' sub-fields.
 * Instead, it attempts to fetch average grades directly from 'progresses' and 'results' tables,
 * assuming these are available as direct relationships on the 'user' type.
 *
 * NOTE: If 'progresses' or 'results' fields also cause errors or have a different structure,
 * you will need to inspect the GraphQL schema on the platform's GraphiQL interface
 * (at https://learn.zone01kisumu.ke/api/graphql-engine/v1/graphql) to find the correct way
 * to query for grades and audit information.
 */
const USER_PROFILE_QUERY = `
query UserProfile {
  user {
    # Basic user info
    id
    login
    email
    auditRatio

    # XP Metrics - Filtered by eventId 75 (module)
    totalXp: transactions_aggregate(
      where: {
        _and: [
          {type: {_eq: "xp"}},
          {eventId: {_eq: 75}}
        ]
      }
    ) {
      aggregate {
        sum {
          amount
        }
      }
    }

    # Grade Metrics - Filtered by eventId 75 (module)
    averageProgressGrade: progresses_aggregate(
      where: {
        _and: [
          {grade: {_neq: 0}},
          {eventId: {_eq: 75}}
        ]
      }
    ) {
      aggregate {
        avg {
          grade
        }
      }
    }
    
    averageResultGrade: results_aggregate(
      where: {
        _and: [
          {grade: {_neq: 0}},
          {eventId: {_eq: 75}}
        ]
      }
    ) {
      aggregate {
        avg {
          grade
        }
      }
    }

    # Transaction Data - Filtered by eventId 75 (module)
    transactions(
      where: {eventId: {_eq: 75}}
      order_by: {createdAt: asc}
    ) {
      amount
      type
      createdAt
      eventId
      object {
        name
        type
      }
    }

    # Results Data - Filtered by eventId 75 (module)
    results(
      where: {eventId: {_eq: 75}}
      order_by: {createdAt: asc}
    ) {
      grade
      type
      path
      createdAt
      object {
        name
      }
    }

    # Skills Data - Filtered by eventId 75 (module)
    skill_types: transactions_aggregate(
      distinct_on: [type]
      where: {
        _and: [
          {type: {_nin: ["xp", "level", "up", "down"]}},
          {eventId: {_eq: 75}}
        ]
      }
      order_by: [
        {type: asc}
        {amount: desc}
      ]
    ) {
      nodes {
        type
        amount
      }
    }

    # Progress Data - Filtered by eventId 75 (module)
    progresses(
      where: {
        _and: [
          {grade: {_neq: 0}},
          {eventId: {_eq: 75}}
        ]
      }
    ) {
      grade
      path
      createdAt
      object {
        name
      }
    }
  }
  
  # Get module information
  event(where: {path: {_eq: "/kisumu/module"}}) {
    startAt
    endAt
  }
}
`;


/**
 * Loads and displays the user profile page.
 */
async function loadProfilePage(eventId = 75) {
    loginSection.style.display = 'none';
    fixedHeaderContainer.style.display = 'flex';
    profileContentScrollArea.style.display = 'flex';

    fixedHeaderContainer.innerHTML = '';
    profileContentScrollArea.innerHTML = '<div class="loading-spinner"></div><p>Loading profile...</p>';

    const data = await fetchGraphQLData(USER_PROFILE_QUERY);
    console.log('Fetched profile data:', data);

    if (!data || !data.user || data.user.length === 0) {
        profileContentScrollArea.innerHTML = '<p class="error-message">Could not load profile data. Please try again or log in.</p>';
        return;
    }

    const user = data.user[0];

    // Calculate aggregated data
    const totalXp = user.totalXp?.aggregate?.sum?.amount || 0;
    const totalXpMB = (totalXp / 1000000).toFixed(2); // Convert to MB with 2 decimal places
    
    // Get audit ratio (default to 0 if not available)
    const auditRatio = user.auditRatio?.toFixed(1) || '0.0';

    const avgGrade = (user.averageProgressGrade?.aggregate?.avg?.grade ||
                    user.averageResultGrade?.aggregate?.avg?.grade)?.toFixed(2) || 'N/A';

    const xpProgressData = calculateXpProgress(user.transactions);
    const xpByProjectData = calculateXpByProject(user.transactions);

    // Render the fixed header
    fixedHeaderContainer.innerHTML = `
        <header class="profile-header">
            <h1 class="profile-title">Welcome, ${user.login}!</h1>
            <button id="logout-button" class="logout-button">Logout</button>
        </header>
    `;

    // Render the scrollable profile content
    profileContentScrollArea.innerHTML = `
        <section class="profile-summary">
            <div class="summary-card">
                <h3>Total XP</h3>
                <p>${totalXpMB} MB</p>
            </div>
            <div class="summary-card">
                <h3>Average Grade</h3>
                <p>${avgGrade}</p>
            </div>
            <div class="summary-card">
                <h3>Audit Ratio</h3>
                <p>${auditRatio}</p>
            </div>
        </section>

        <section class="statistics-section">
            <h2>Your Journey in Numbers</h2>
            <div class="chart-container">
                <div class="chart-box">
                    <div id="xp-progress-chart" class="chart-canvas"></div>
                </div>
                <div class="chart-box">
                    <div id="xp-by-project-chart" class="chart-canvas"></div>
                </div>
                <div class="chart-box">
                    <h3>Skills</h3>
                    <div id="skills-radar-chart" class="chart-canvas"></div>
                </div>
            </div>
        </section>
    `;

    // Attach event listener to the logout button
    document.getElementById('logout-button').addEventListener('click', logout);

    // Draw graphs
    const xpProgressChartContainer = document.getElementById('xp-progress-chart');
    const xpByProjectChartContainer = document.getElementById('xp-by-project-chart');
    const skillsRadarChartContainer = document.getElementById('skills-radar-chart');

    drawXpProgressLineChart(xpProgressChartContainer, xpProgressData);
    drawXpByProjectBarChart(xpByProjectChartContainer, xpByProjectData);
    
    if (user.skill_types && user.skill_types.nodes) {
        drawSkillsRadarChart(skillsRadarChartContainer, user.skill_types.nodes);
    }
}

// Initial check on page load
document.addEventListener('DOMContentLoaded', () => {
    loginForm.addEventListener('submit', handleLogin);

    // Check if a JWT token exists in localStorage
    const storedJwtToken = localStorage.getItem('jwtToken');
    if (storedJwtToken) {
        console.log('JWT token found. Attempting to load profile...');
        loadProfilePage(); // If token exists, try to load profile directly
    } else {
        console.log('No JWT token found. Displaying login page.');
        loginSection.style.display = 'flex'; // Ensure login is visible
        fixedHeaderContainer.style.display = 'none'; // Ensure fixed header is hidden
        profileContentScrollArea.style.display = 'none'; // Ensure scrollable content is hidden
    }
});
