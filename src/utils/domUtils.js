/**
 * DOM utility functions
 */

/**
 * Creates a debounced version of a function
 * @param {Function} func - The function to debounce
 * @param {number} wait - The delay in milliseconds
 * @returns {Function} - The debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Safely gets computed style property
 * @param {HTMLElement} element - The element
 * @param {string} property - The CSS property name
 * @returns {string} - The property value
 */
export function getStyleProperty(element, property) {
    return getComputedStyle(element).getPropertyValue(property);
}

