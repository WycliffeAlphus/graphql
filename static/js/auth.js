// auth
import { SIGNIN_ENDPOINT, ERROR_MESSAGES } from './config.js';
import { getDOMElements } from './domElements.js';
import { loadProfilePage } from './profile.js';

const { errorMessageDiv } = getDOMElements();

/**
 * Displays a user-friendly error message
 * @param {string} message - The error message to display
 */
export function displayErrorMessage(message) {
    if (!errorMessageDiv) return;
    
    errorMessageDiv.textContent = message;
    errorMessageDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorMessageDiv.style.display = 'none';
    }, 5000);
}

/**
 * Hides the error message
 */
export function hideErrorMessage() {
    if (errorMessageDiv) {
        errorMessageDiv.textContent = '';
        errorMessageDiv.style.display = 'none';
    }
}

/**
 * Handles user login
 * @param {Event} event - Form submission event
 */
export async function handleLogin(event) {
    event.preventDefault();
    hideErrorMessage();

    const { usernameEmailInput, passwordInput } = getDOMElements();
    const usernameEmail = usernameEmailInput.value.trim();
    const password = passwordInput.value;

    if (!usernameEmail || !password) {
        displayErrorMessage('Please enter both username/email and password.');
        return;
    }

    try {
        const credentials = btoa(`${usernameEmail}:${password}`);
        const response = await fetch(SIGNIN_ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Login failed:', response.status, errorText);
            
            if (response.status === 401 || response.status === 403) {
                displayErrorMessage(ERROR_MESSAGES.INVALID_CREDENTIALS);
            } else {
                displayErrorMessage(`${ERROR_MESSAGES.NETWORK_ERROR} (Status: ${response.status})`);
            }
            return;
        }

        let jwtToken = await response.text();
        jwtToken = jwtToken.replace(/^"|"$/g, '');

        if (!jwtToken) {
            displayErrorMessage(ERROR_MESSAGES.JWT_ERROR);
            return;
        }

        try {
            localStorage.setItem('jwtToken', jwtToken);
            loadProfilePage();
        } catch (storageError) {
            console.error('Storage error:', storageError);
            displayErrorMessage(ERROR_MESSAGES.STORAGE_ERROR);
        }

    } catch (error) {
        console.error('Login error:', error);
        displayErrorMessage(ERROR_MESSAGES.NETWORK_ERROR);
    }
}

/**
 * Logs out the user by clearing the token and resetting the UI
 */
export function logout() {
    try {
        localStorage.removeItem('jwtToken');
        const { 
            fixedHeaderContainer, 
            profileContentScrollArea, 
            loginSection, 
            usernameEmailInput, 
            passwordInput 
        } = getDOMElements();

        if (fixedHeaderContainer) {
            fixedHeaderContainer.style.display = 'none';
            fixedHeaderContainer.innerHTML = '';
        }

        if (profileContentScrollArea) {
            profileContentScrollArea.style.display = 'none';
            profileContentScrollArea.innerHTML = '';
        }

        if (loginSection) loginSection.style.display = 'flex';
        if (usernameEmailInput) usernameEmailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        
        hideErrorMessage();
    } catch (error) {
        console.error('Logout error:', error);
        displayErrorMessage(ERROR_MESSAGES.UNKNOWN_ERROR);
    }
}