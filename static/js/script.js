// script.js
import { getDOMElements } from './domElements.js';
import { handleLogin, logout } from './auth.js';
import { loadProfilePage } from './profile.js';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const { loginForm, loginSection, fixedHeaderContainer, profileContentScrollArea } = getDOMElements();

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    // Check for existing session
    try {
        const storedJwtToken = localStorage.getItem('jwtToken');
        if (storedJwtToken) {
            console.log('Existing session found, loading profile...');
            loadProfilePage();
        } else {
            console.log('No session found, showing login form');
            if (loginSection) loginSection.style.display = 'flex';
            if (fixedHeaderContainer) fixedHeaderContainer.style.display = 'none';
            if (profileContentScrollArea) profileContentScrollArea.style.display = 'none';
        }
    } catch (error) {
        console.error('Initialization error:', error);
        if (loginSection) loginSection.style.display = 'flex';
    }
});