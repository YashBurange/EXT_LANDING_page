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
     * Merges with adjacent markers of the same user/type to avoid "box overload"
     */
    show(lineNumber, userName, persistent = true, changeType = 'edited', endLine = null) {
        if (lineNumber === null || lineNumber < 1) return;

        const editor = this.markerLayer.parentElement?.querySelector('.code-editor');
        if (!editor) return;

        // Current request range
        const currentStart = lineNumber;
        const currentEnd = endLine ? endLine : lineNumber;

        // --- 1. SEARCH FOR ADJACENCY ---
        // We look for existing markers that touch this new range:
        // Top adjacency: Existing End + 1 === Current Start
        // Bottom adjacency: Current End + 1 === Existing Start
        // Overlap: existing marker contains or intersects current range (shouldn't happen often with logic, but good to handle)

        let merged = false;

        // Iterate through all existing markers to find merge candidates
        // We convert to array to handle deletions safely while iterating if needed, 
        // essentially we restart if we merge to avoid complexity or just find the one to merge.
        const markers = Array.from(this.persistentMarkers.values());

        for (const existingMarker of markers) {
            const exStart = parseInt(existingMarker.dataset.line);
            const exEnd = parseInt(existingMarker.dataset.endLine || exStart);
            const exUser = existingMarker.dataset.rawUser; // We need to store raw username to check equality safely
            const exType = existingMarker.dataset.changeType;

            // Only merge if same user and same change type (added vs edited)
            if (exUser === userName && exType === changeType) {

                // Case A: New range touches/extends the BOTTOM of existing marker
                // Ex: Existing 1-2, New 3. (2+1 == 3)
                if (exEnd + 1 === currentStart) {
                    this.updateMarkerRange(existingMarker, exStart, currentEnd);
                    merged = true;
                    break;
                }

                // Case B: New range touches/extends the TOP of existing marker
                // Ex: Existing 3-4, New 2. (2+1 == 3)
                if (currentEnd + 1 === exStart) {
                    this.updateMarkerRange(existingMarker, currentStart, exEnd);
                    merged = true;
                    break;
                }

                // Case C: Overlap/Inside (should logically just be an update, but we treat as merge)
                if ((currentStart >= exStart && currentStart <= exEnd) || (currentEnd >= exStart && currentEnd <= exEnd)) {
                    // It's inside or overlapping. Expand range to cover both.
                    const newMin = Math.min(exStart, currentStart);
                    const newMax = Math.max(exEnd, currentEnd);
                    this.updateMarkerRange(existingMarker, newMin, newMax);
                    merged = true;
                    break;
                }
            }
        }

        if (merged) {
            // If we merged, we might have created a "bridge" between two previously separate markers.
            // e.g. had 1-2 and 4-5. Added 3. Now we have 1-3. We should check if 1-3 touches 4-5 and merge them too.
            this.consolidateAllMarkers();
            return;
        }

        // --- 2. CREATE NEW MARKER (If no merge) ---

        const marker = document.createElement('div');
        marker.className = `marker ${this.userClass} persistent`;
        if (changeType === 'added') {
            marker.classList.add('line-added');
        } else {
            marker.classList.add('line-edited');
        }

        // Store data
        marker.dataset.line = currentStart;
        marker.dataset.endLine = currentEnd; // Always set endLine for consistency
        marker.dataset.persistent = 'true';
        marker.dataset.changeType = changeType;
        marker.dataset.rawUser = userName; // Store simple username for checks

        // Label logic
        this.updateMarkerLabel(marker, userName, changeType, currentStart, currentEnd);

        // Position
        this.updateMarkerVisuals(marker, editor, currentStart, currentEnd);

        this.markerLayer.appendChild(marker);
        // Use the start line as the map key, but note that with ranges, keys in map might get tricky.
        // Ideally we track by unique ID, but the code uses line numbers.
        // We'll trust that we clean up old markers on that line if they existed.
        this.persistentMarkers.set(currentStart, marker);
    }

    /**
     * Updates an existing marker's range and visuals
     */
    updateMarkerRange(marker, newStart, newEnd) {
        // Remove from map with old key
        const oldStart = parseInt(marker.dataset.line);
        this.persistentMarkers.delete(oldStart);

        // Update data
        marker.dataset.line = newStart;
        marker.dataset.endLine = newEnd;

        // Re-add to map with new key
        this.persistentMarkers.set(newStart, marker);

        // Update Label
        const userName = marker.dataset.rawUser;
        const changeType = marker.dataset.changeType;
        this.updateMarkerLabel(marker, userName, changeType, newStart, newEnd);

        // Update visuals
        const editor = this.markerLayer.parentElement?.querySelector('.code-editor');
        if (editor) {
            this.updateMarkerVisuals(marker, editor, newStart, newEnd);
        }
    }

    updateMarkerLabel(marker, userName, changeType, start, end) {
        if (changeType === 'added') {
            const rangeText = end > start ? `lines ${start}-${end}` : `line ${start}`;
            marker.dataset.label = `${userName} added ${rangeText}`;
        } else {
            marker.dataset.label = `${userName} edited`;
        }
    }

    updateMarkerVisuals(marker, editor, start, end) {
        // Ensure styling for position
        if (getComputedStyle(this.markerLayer).position === 'static') {
            this.markerLayer.style.position = 'absolute';
        }

        const topPosition = calculateMarkerPosition(editor, start);
        marker.style.top = `${topPosition}px`;
        marker.style.position = 'absolute';
        marker.style.left = '0';
        marker.style.right = '0';
        marker.style.zIndex = '10';
        marker.style.pointerEvents = 'none';

        // Calculate height based on lines spanned
        const fontSize = parseFloat(getComputedStyle(editor).fontSize) || 14.4;
        const lineHeight = fontSize * 1.5;
        const lineCount = (end - start) + 1;
        const height = lineCount * lineHeight;
        marker.style.height = `${height}px`;
    }

    /**
     * Scans all markers and merges any that are touching.
     * Useful after update operations that might bridge gaps.
     */
    consolidateAllMarkers() {
        const markers = Array.from(this.persistentMarkers.values())
            .sort((a, b) => parseInt(a.dataset.line) - parseInt(b.dataset.line));

        if (markers.length < 2) return;

        for (let i = 0; i < markers.length - 1; i++) {
            const curr = markers[i];
            const next = markers[i + 1];

            const currStart = parseInt(curr.dataset.line);
            const currEnd = parseInt(curr.dataset.endLine || currStart);
            const nextStart = parseInt(next.dataset.line);
            const nextEnd = parseInt(next.dataset.endLine || nextStart);

            const currUser = curr.dataset.rawUser;
            const nextUser = next.dataset.rawUser;

            // Check adjacency and same user
            if (currUser === nextUser && currEnd + 1 === nextStart) {
                // Merge Next into Curr
                const newEnd = nextEnd;

                // Remove 'next' from DOM and Map
                next.remove();
                this.persistentMarkers.delete(nextStart);

                // Update 'curr'
                this.updateMarkerRange(curr, currStart, newEnd);

                // Decrement i to re-check this merged marker against the next one
                i--;

                // Update main list reference (hacky but needed since we modified the DOM elements)
                markers.splice(i + 2, 1); // remove the consumed marker from our local array
            }
        }
    }

    clear() {
        const existingMarker = this.markers.get(this.userClass);
        if (existingMarker) {
            existingMarker.remove();
            this.markers.delete(this.userClass);
        }
    }

    clearAll() {
        this.clear();
        this.persistentMarkers.forEach(marker => marker.remove());
        this.persistentMarkers.clear();
    }

    clearPersistentMarkers() {
        this.persistentMarkers.forEach(marker => marker.remove());
        this.persistentMarkers.clear();
    }

    getPersistentMarkers() {
        const markers = [];
        this.persistentMarkers.forEach((marker, lineNumber) => {
            let userName = marker.dataset.label;
            // Basic clean up if needed, though we store rawUser now
            if (userName) {
                userName = userName.split(' ')[0];
            }

            markers.push({
                lineNumber: parseInt(marker.dataset.line),
                userName: marker.dataset.rawUser || userName || 'Unknown',
                userClass: this.userClass,
                changeType: marker.dataset.changeType || 'edited'
            });
        });
        return markers;
    }

    restorePersistentMarkers(markersData) {
        if (!markersData || !Array.isArray(markersData)) return;

        markersData.forEach(({ lineNumber, userName, changeType = 'edited' }) => {
            // existing check etc
            // Simply calling show() will trigger the new merge logic!
            this.show(lineNumber, userName, true, changeType);
        });
    }

    updatePosition() {
        // Update all persistent markers
        this.persistentMarkers.forEach((marker) => {
            const editor = this.markerLayer.parentElement?.querySelector('.code-editor');
            if (editor) {
                const start = parseInt(marker.dataset.line);
                const end = parseInt(marker.dataset.endLine || start);
                this.updateMarkerVisuals(marker, editor, start, end);
            }
        });
    }

    adjustByContent(oldLines, newLines) {
        // Complex to handle perfectly with ranges, deleting for now to simplify
        // or just clearing and re-calculating would be safer.
        // For this demo refactor, we'll leave it as a no-op or simple position update
        // since the main logic is re-driven by 'show' calls from the editor.
        this.updatePosition();
    }
}

