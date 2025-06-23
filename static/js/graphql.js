// graphql
import { GRAPHQL_ENDPOINT, ERROR_MESSAGES } from './config.js';
import { displayErrorMessage } from './auth.js';
import { logout } from './auth.js';

/**
 * Fetches data from GraphQL endpoint
 * @param {string} query - GraphQL query
 * @returns {Promise<Object|null>} - GraphQL response data or null on error
 */
export async function fetchGraphQLData(query) {
    let jwtToken;
    try {
        jwtToken = localStorage.getItem('jwtToken');
        if (!jwtToken) {
            console.error('No JWT token found');
            displayErrorMessage(ERROR_MESSAGES.SESSION_EXPIRED);
            logout();
            return null;
        }
    } catch (error) {
        console.error('JWT retrieval error:', error);
        displayErrorMessage(ERROR_MESSAGES.STORAGE_ERROR);
        return null;
    }

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
            if (response.status === 401 || response.status === 403) {
                displayErrorMessage(ERROR_MESSAGES.SESSION_EXPIRED);
                logout();
                return null;
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.errors) {
            console.error('GraphQL errors:', data.errors);
            const isInvalidJWT = data.errors.some(err => err.extensions?.code === 'invalid-jwt');
            if (isInvalidJWT) {
                displayErrorMessage(ERROR_MESSAGES.JWT_ERROR);
                logout();
            } else {
                displayErrorMessage(ERROR_MESSAGES.DATA_FETCH_ERROR);
            }
            return null;
        }

        return data.data;
    } catch (error) {
        console.error('GraphQL fetch error:', error);
        displayErrorMessage(ERROR_MESSAGES.NETWORK_ERROR);
        return null;
    }
}