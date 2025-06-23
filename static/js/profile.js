// profile
import { fetchGraphQLData } from './graphql.js';
import { calculateXpProgress, calculateXpByProject } from './calculations.js';
import { drawSkillsRadarChart, drawXpProgressLineChart, drawXpByProjectBarChart } from './charts.js';
import { ERROR_MESSAGES } from './config.js';
import { getDOMElements } from './domElements.js';
import { logout } from './auth.js';

const USER_PROFILE_QUERY = `
query UserProfile {
  user {
    id
    login
    email
    auditRatio
    totalXp: transactions_aggregate(where: {_and: [{type: {_eq: "xp"}}, {eventId: {_eq: 75}}]}) {
      aggregate { sum { amount } }
    }
    averageProgressGrade: progresses_aggregate(where: {_and: [{grade: {_neq: 0}}, {eventId: {_eq: 75}}]}) {
      aggregate { avg { grade } }
    }
    averageResultGrade: results_aggregate(where: {_and: [{grade: {_neq: 0}}, {eventId: {_eq: 75}}]}) {
      aggregate { avg { grade } }
    }
    transactions(where: {eventId: {_eq: 75}}, order_by: {createdAt: asc}) {
      amount
      type
      createdAt
      eventId
      object { name type }
    }
    results(where: {eventId: {_eq: 75}}, order_by: {createdAt: asc}) {
      grade
      type
      path
      createdAt
      object { name }
    }
    skill_types: transactions_aggregate(
      distinct_on: [type]
      where: {_and: [{type: {_nin: ["xp", "level", "up", "down"]}}, {eventId: {_eq: 75}}]}
      order_by: [{type: asc}, {amount: desc}]
    ) {
      nodes { type amount }
    }
    progresses(where: {_and: [{grade: {_neq: 0}}, {eventId: {_eq: 75}}]}) {
      grade
      path
      createdAt
      object { name }
    }
  }
  event(where: {path: {_eq: "/kisumu/module"}}) {
    startAt
    endAt
  }
}
`;

/**
 * Loads and displays the user profile page
 * @param {number} eventId - The event ID to filter by (default: 75)
 */
export async function loadProfilePage(eventId = 75) {
    const { 
        loginSection, 
        fixedHeaderContainer, 
        profileContentScrollArea 
    } = getDOMElements();

    if (!loginSection || !fixedHeaderContainer || !profileContentScrollArea) {
        console.error('Required DOM elements not found');
        return;
    }

    loginSection.style.display = 'none';
    fixedHeaderContainer.style.display = 'flex';
    profileContentScrollArea.style.display = 'flex';
    profileContentScrollArea.innerHTML = '<div class="loading-spinner"></div><p>Loading profile...</p>';

    try {
        const data = await fetchGraphQLData(USER_PROFILE_QUERY);
        if (!data || !data.user || data.user.length === 0) {
            throw new Error('No user data received');
        }

        renderProfile(data.user[0]);
    } catch (error) {
        console.error('Profile load error:', error);
        profileContentScrollArea.innerHTML = `
            <p class="error-message">${ERROR_MESSAGES.DATA_FETCH_ERROR}</p>
            <button class="retry-button">Try Again</button>
        `;
        
        const retryButton = profileContentScrollArea.querySelector('.retry-button');
        if (retryButton) {
            retryButton.addEventListener('click', loadProfilePage);
        }
    }
}

/**
 * Renders the profile page with user data
 * @param {Object} user - User data object
 */
function renderProfile(user) {
    const { fixedHeaderContainer, profileContentScrollArea } = getDOMElements();

    // Calculate metrics
    const totalXp = user.totalXp?.aggregate?.sum?.amount || 0;
    const totalXpMB = (totalXp / 1000000).toFixed(2);
    const projectXpTransactions = user.transactions.filter(t => t.type === 'xp' && t.object?.type === 'project');
    const totalProjectXp = projectXpTransactions.reduce((sum, t) => sum + t.amount, 0);
    const projectXpMB = (totalProjectXp / 1000000).toFixed(2);
    const auditRatio = user.auditRatio?.toFixed(1) || '0.0';
    const avgGrade = (user.averageProgressGrade?.aggregate?.avg?.grade ||
                    user.averageResultGrade?.aggregate?.avg?.grade)?.toFixed(2) || 'N/A';

    // Calculate chart data
    const xpProgressData = calculateXpProgress(user.transactions);
    const xpByProjectData = calculateXpByProject(user.transactions);

    // Render header
    fixedHeaderContainer.innerHTML = `
        <header class="profile-header">
            <h1 class="profile-title">Welcome, ${user.login}!</h1>
            <button id="logout-button" class="logout-button">Logout</button>
        </header>
    `;

    // Render profile content
    profileContentScrollArea.innerHTML = `
        <section class="profile-summary">
            <div class="summary-card">
                <h3>Total XP</h3>
                <p>${totalXpMB} MB</p>
                <small>All activities</small>
            </div>
            <div class="summary-card">
                <h3>Project XP</h3>
                <p>${projectXpMB} MB</p>
                <small>Projects only</small>
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

    // Add logout event listener
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // Draw charts
    drawXpProgressLineChart(document.getElementById('xp-progress-chart'), xpProgressData);
    drawXpByProjectBarChart(document.getElementById('xp-by-project-chart'), xpByProjectData);
    
    if (user.skill_types?.nodes) {
        drawSkillsRadarChart(document.getElementById('skills-radar-chart'), user.skill_types.nodes);
    }
}