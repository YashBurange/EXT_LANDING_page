/**
 * Utility functions for tracking cursor position and line numbers
 */

/**
 * Gets the current line number where the cursor is positioned
 * @param {HTMLElement} editor - The contenteditable editor element
 * @returns {number|null} - The current line number (1-indexed) or null if unable to determine
 */
export function getCurrentLine(editor) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0 || !selection.anchorNode) return null;
    
    try {
        // Get the text content up to the cursor
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.setEnd(selection.anchorNode, selection.anchorOffset);
        
        const textBeforeCursor = range.toString();
        const lineNumber = textBeforeCursor.split('\n').length;
        
        return lineNumber; // Line number (1-indexed)
    } catch (e) {
        // Fallback: count lines in full text
        const text = editor.textContent || editor.innerText;
        return text.split('\n').length;
    }
}

/**
 * Gets the text content of a specific line
 * @param {HTMLElement} editor - The contenteditable editor element
 * @param {number} lineNum - The line number (1-indexed)
 * @returns {string} - The text content of the line
 */
export function getLineText(editor, lineNum) {
    const text = editor.textContent || editor.innerText;
    const lines = text.split('\n');
    return lines[lineNum - 1] || '';
}

/**
 * Calculates the vertical position for a marker at a given line number
 * @param {HTMLElement} editor - The editor element
 * @param {number} lineNumber - The line number (1-indexed)
 * @returns {number} - The top position in pixels
 */
export function calculateMarkerPosition(editor, lineNumber) {
    const fontSize = parseFloat(getComputedStyle(editor).fontSize);
    const lineHeight = fontSize * 1.5; // 1.5em line-height
    const padding = 10; // Top padding of editor
    return (lineNumber - 1) * lineHeight + padding;
}

