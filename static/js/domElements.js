// domElements
export const getDOMElements = () => {
    return {
        loginSection: document.getElementById('login-section'),
        fixedHeaderContainer: document.getElementById('fixed-header-container'),
        profileContentScrollArea: document.getElementById('profile-content-scroll-area'),
        loginForm: document.getElementById('login-form'),
        usernameEmailInput: document.getElementById('username-email'),
        passwordInput: document.getElementById('password'),
        errorMessageDiv: document.getElementById('error-message'),
        logoutButton: document.getElementById('logout-button'),
        xpProgressChart: document.getElementById('xp-progress-chart'),
        xpByProjectChart: document.getElementById('xp-by-project-chart'),
        skillsRadarChart: document.getElementById('skills-radar-chart')
    };
};