import { calculateMarkerPosition } from '../utils/lineTracking.js';

/**
 * Marker Component
 * Manages visual markers for showing which lines users are editing
 */
export class Marker {
    constructor(markerLayer, options = {}) {
        this.markerLayer = markerLayer;
        this.userClass = options.userClass || 'user-default';
        this.markers = new Map(); // Track markers by user class
        this.persistentMarkers = new Map(); // Track persistent markers (pushed edits) by line number
    }
    
    /**
     * Shows a marker at the specified line or range
     * ALL markers are now permanent until pulled
     * @param {number} lineNumber - The line number (1-indexed) or start line for range
     * @param {string} userName - The name of the user
     * @param {boolean} persistent - Always true now (all markers are permanent)
     * @param {string} changeType - Type of change: 'added' (new line) or 'edited' (existing line modified)
     * @param {number} endLine - Optional end line number for range markers
     */
    show(lineNumber, userName, persistent = true, changeType = 'edited', endLine = null) {
        if (lineNumber === null || lineNumber < 1) return;
        
        const editor = this.markerLayer.parentElement?.querySelector('.code-editor');
        if (!editor) return;
        
        // For range markers, use startLine as key
        const markerKey = endLine ? `${lineNumber}-${endLine}` : lineNumber;
        
        // Check if there's already a marker at this line/range
        if (this.persistentMarkers.has(markerKey)) {
            // Update existing marker if change type is different
            const existingMarker = this.persistentMarkers.get(markerKey);
            if (existingMarker.dataset.changeType !== changeType) {
                existingMarker.dataset.changeType = changeType;
                if (changeType === 'added') {
                    existingMarker.classList.remove('line-edited');
                    existingMarker.classList.add('line-added');
                    const rangeText = endLine && endLine > lineNumber ? `lines ${lineNumber}-${endLine}` : `line ${lineNumber}`;
                    existingMarker.dataset.label = `${userName} added ${rangeText}`;
                } else {
                    existingMarker.classList.remove('line-added');
                    existingMarker.classList.add('line-edited');
                    existingMarker.dataset.label = `${userName} edited`;
                }
            }
            return; // Already have a marker here
        }
        
        const marker = document.createElement('div');
        marker.className = `marker ${this.userClass} persistent`;
        if (changeType === 'added') {
            marker.classList.add('line-added');
            const rangeText = endLine && endLine > lineNumber ? `lines ${lineNumber}-${endLine}` : `line ${lineNumber}`;
            marker.dataset.label = `${userName} added ${rangeText}`;
        } else {
            marker.classList.add('line-edited');
            marker.dataset.label = `${userName} edited`;
        }
        
        marker.dataset.line = lineNumber;
        if (endLine) {
            marker.dataset.endLine = endLine;
            marker.classList.add('range-marker');
        }
        marker.dataset.persistent = 'true';
        marker.dataset.changeType = changeType;
        
        // Ensure marker layer is positioned correctly
        if (getComputedStyle(this.markerLayer).position === 'static') {
            this.markerLayer.style.position = 'absolute';
        }
        
        const topPosition = calculateMarkerPosition(editor, lineNumber);
        marker.style.top = `${topPosition}px`;
        marker.style.position = 'absolute';
        marker.style.left = '0';
        marker.style.right = '0';
        marker.style.zIndex = '10';
        marker.style.pointerEvents = 'none';
        
        // For range markers, calculate height
        if (endLine && endLine > lineNumber) {
            const fontSize = parseFloat(getComputedStyle(editor).fontSize) || 14.4;
            const lineHeight = fontSize * 1.5;
            const height = (endLine - lineNumber + 1) * lineHeight;
            marker.style.height = `${height}px`;
        } else {
            marker.style.height = '1.5em';
        }
        
        this.markerLayer.appendChild(marker);
        this.persistentMarkers.set(markerKey, marker);
        
        // Force a reflow to ensure visibility
        marker.offsetHeight;
        
        // Debug: log marker creation
        console.log('Marker created:', { 
            lineNumber, 
            endLine, 
            userName, 
            changeType, 
            topPosition,
            markerLayer: this.markerLayer,
            markerElement: marker,
            markerInDOM: marker.parentElement === this.markerLayer
        });
        
        // Verify marker is visible
        const rect = marker.getBoundingClientRect();
        console.log('Marker bounds:', { 
            top: rect.top, 
            left: rect.left, 
            width: rect.width, 
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
        });
    }
    
    /**
     * Clears the marker for this user (only temporary markers, not persistent ones)
     */
    clear() {
        const existingMarker = this.markers.get(this.userClass);
        if (existingMarker) {
            existingMarker.remove();
            this.markers.delete(this.userClass);
        }
    }
    
    /**
     * Clears all markers including persistent ones
     */
    clearAll() {
        this.clear();
        this.persistentMarkers.forEach(marker => marker.remove());
        this.persistentMarkers.clear();
    }
    
    /**
     * Gets all persistent marker data (for saving/restoring)
     * @returns {Array} Array of {lineNumber, userName, userClass, changeType}
     */
    getPersistentMarkers() {
        const markers = [];
        this.persistentMarkers.forEach((marker, lineNumber) => {
            let userName = marker.dataset.label;
            // Extract user name from label
            userName = userName.replace(' edited', '')
                              .replace(' added line (add code above/below)', '')
                              .replace(' added line', '')
                              .replace(' adding line', '')
                              .replace(' editing', '');
            
            markers.push({
                lineNumber: parseInt(marker.dataset.line),
                userName: userName.trim(),
                userClass: this.userClass,
                changeType: marker.dataset.changeType || 'edited'
            });
        });
        return markers;
    }
    
    /**
     * Restores persistent markers from data
     * @param {Array} markersData - Array of {lineNumber, userName, userClass, changeType}
     */
    restorePersistentMarkers(markersData) {
        if (!markersData || !Array.isArray(markersData)) return;
        
        markersData.forEach(({lineNumber, userName, changeType = 'edited'}) => {
            // Check if marker already exists in DOM
            const existingMarker = this.persistentMarkers.get(lineNumber);
            if (existingMarker && existingMarker.parentElement) {
                // Marker already exists and is in DOM, skip
                return;
            }
            // If marker was removed from DOM but still in Map, remove from Map
            if (existingMarker && !existingMarker.parentElement) {
                this.persistentMarkers.delete(lineNumber);
            }
            // Create the marker
            this.show(lineNumber, userName, true, changeType);
        });
    }
    
    /**
     * Clears all persistent markers (called after successful git pull)
     */
    clearPersistentMarkers() {
        this.persistentMarkers.forEach(marker => marker.remove());
        this.persistentMarkers.clear();
    }
    
    /**
     * Updates marker position (useful when content changes)
     */
    updatePosition() {
        // Update temporary marker
        const marker = this.markers.get(this.userClass);
        if (marker) {
            const lineNumber = parseInt(marker.dataset.line);
            const editor = this.markerLayer.parentElement?.querySelector('.code-editor');
            if (editor) {
                const topPosition = calculateMarkerPosition(editor, lineNumber);
                marker.style.top = `${topPosition}px`;
            }
        }
        
        // Update all persistent markers
        this.persistentMarkers.forEach((marker, lineNumber) => {
            const editor = this.markerLayer.parentElement?.querySelector('.code-editor');
            if (editor) {
                const topPosition = calculateMarkerPosition(editor, lineNumber);
                marker.style.top = `${topPosition}px`;
            }
        });
    }
    
    /**
     * Adjusts markers by matching line content when content changes
     * This ensures markers track the actual line content, not just line numbers
     * @param {Array<string>} oldLines - Previous lines
     * @param {Array<string>} newLines - New lines after change
     */
    adjustByContent(oldLines, newLines) {
        const markersToUpdate = [];
        
        this.persistentMarkers.forEach((markerElement, lineNumber) => {
            if (lineNumber <= oldLines.length) {
                const oldLineContent = oldLines[lineNumber - 1];
                // Find this line content in new lines
                const newLineIndex = newLines.findIndex(line => line === oldLineContent);
                if (newLineIndex !== -1) {
                    const newLineNumber = newLineIndex + 1;
                    if (newLineNumber !== lineNumber) {
                        markersToUpdate.push({ 
                            markerElement, 
                            oldLine: lineNumber, 
                            newLine: newLineNumber 
                        });
                    }
                } else {
                    // Line content not found - might have been deleted or changed
                    // Keep marker at same position for now
                }
            }
        });
        
        // Update marker line numbers
        markersToUpdate.forEach(({ markerElement, oldLine, newLine }) => {
            this.persistentMarkers.delete(oldLine);
            markerElement.dataset.line = newLine;
            this.persistentMarkers.set(newLine, markerElement);
        });
        
        // Update positions
        if (markersToUpdate.length > 0) {
            this.updatePosition();
        }
    }
}

