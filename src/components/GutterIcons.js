/**
 * GutterIcons Component
 * Manages colored dots/avatars in the left margin showing who owns what block of code
 */
export class GutterIcons {
    constructor(gutterElement, options = {}) {
        this.gutter = gutterElement;
        this.icons = new Map(); // Track icons by line number
        this.userColors = options.userColors || {
            'User A': '#00ff99',
            'User B': '#bd93f9'
        };
        this.userAvatars = options.userAvatars || {
            'User A': 'A',
            'User B': 'B'
        };
        this.onIconClick = options.onIconClick || (() => { });
        this.onIconHover = options.onIconHover || (() => { });
    }

    /**
     * Shows an icon at the specified line or range
     * @param {number} lineNumber - The line number (1-indexed) or start line for range
     * @param {string} userName - The name of the user
     * @param {string} changeType - Type of change: 'added' or 'edited'
     * @param {Object} metadata - Additional metadata (lock duration, etc.)
     * @param {number} endLine - Optional end line number for range markers
     */
    show(lineNumber, userName, changeType = 'edited', metadata = {}, endLine = null) {
        if (lineNumber === null || lineNumber < 1) return;

        // For range, show icon on first line and connect line on last line
        const iconKey = endLine ? `${lineNumber}-${endLine}` : lineNumber;

        // Remove existing icon at this line/range if any
        if (endLine) {
            // Remove any icons in the range
            for (let i = lineNumber; i <= endLine; i++) {
                this.hide(i);
            }
        } else {
            this.hide(lineNumber);
        }

        const icon = document.createElement('div');
        icon.className = `gutter-icon ${changeType}`;
        if (endLine && endLine > lineNumber) {
            icon.classList.add('range-start');
        }
        icon.dataset.line = lineNumber;
        if (endLine) {
            icon.dataset.endLine = endLine;
        }
        icon.dataset.userName = userName;
        icon.dataset.changeType = changeType;

        const color = this.userColors[userName] || this.userColors['User A'];
        const avatar = this.userAvatars[userName] || userName.charAt(0).toUpperCase();

        icon.style.backgroundColor = color;
        icon.textContent = avatar;

        // Update metadata with range info
        const rangeMetadata = { ...metadata };
        if (endLine && endLine > lineNumber) {
            rangeMetadata.range = { start: lineNumber, end: endLine };
        }
        icon.title = this.buildTooltip(userName, changeType, rangeMetadata);

        // Position the icon - ensure it's absolutely positioned relative to gutter
        icon.style.position = 'absolute';
        icon.style.left = '5px';

        const lineElement = this.gutter.querySelector(`span:nth-child(${lineNumber})`);
        if (lineElement) {
            icon.style.top = `${lineElement.offsetTop}px`;
        } else {
            // Fallback: calculate position
            const fontSize = parseFloat(getComputedStyle(this.gutter).fontSize) || 14.4;
            const lineHeight = fontSize * 1.5;
            const padding = 10;
            icon.style.top = `${(lineNumber - 1) * lineHeight + padding}px`;
        }

        // Add hover event
        icon.addEventListener('mouseenter', (e) => {
            this.onIconHover(lineNumber, userName, changeType, rangeMetadata, e);
        });

        // Add click event
        icon.addEventListener('click', (e) => {
            this.onIconClick(lineNumber, userName, changeType, rangeMetadata, e);
        });

        // Ensure gutter has position relative for absolute positioning
        if (getComputedStyle(this.gutter).position === 'static') {
            this.gutter.style.position = 'relative';
        }

        this.gutter.appendChild(icon);
        this.icons.set(iconKey, icon);

        // Force a reflow to ensure positioning
        icon.offsetHeight;

        // For range markers, add a connecting line indicator on the end line
        if (endLine && endLine > lineNumber) {
            const endIcon = document.createElement('div');
            endIcon.className = `gutter-icon ${changeType} range-end`;
            endIcon.dataset.line = endLine;
            endIcon.dataset.userName = userName;
            endIcon.dataset.changeType = changeType;
            endIcon.style.backgroundColor = color;
            endIcon.style.opacity = '0.6';
            endIcon.textContent = '└';
            endIcon.title = this.buildTooltip(userName, changeType, rangeMetadata);

            endIcon.style.position = 'absolute';
            endIcon.style.left = '5px';

            const endLineElement = this.gutter.querySelector(`span:nth-child(${endLine})`);
            if (endLineElement) {
                endIcon.style.top = `${endLineElement.offsetTop}px`;
            } else {
                const fontSize = parseFloat(getComputedStyle(this.gutter).fontSize) || 14.4;
                const lineHeight = fontSize * 1.5;
                const padding = 10;
                endIcon.style.top = `${(endLine - 1) * lineHeight + padding}px`;
            }

            this.gutter.appendChild(endIcon);
            this.icons.set(`${iconKey}-end`, endIcon);

            // Force a reflow
            endIcon.offsetHeight;
        }
    }

    /**
     * Hides the icon at the specified line or range
     */
    hide(lineNumber) {
        // Try direct line number
        let icon = this.icons.get(lineNumber);
        if (icon) {
            icon.remove();
            this.icons.delete(lineNumber);
        }

        // Also check for range markers that include this line
        this.icons.forEach((iconElement, key) => {
            if (typeof key === 'string' && key.includes('-')) {
                const [start, end] = key.split('-').map(Number);
                if (lineNumber >= start && lineNumber <= end) {
                    iconElement.remove();
                    this.icons.delete(key);
                    // Also remove end marker if exists
                    const endKey = `${key}-end`;
                    const endIcon = this.icons.get(endKey);
                    if (endIcon) {
                        endIcon.remove();
                        this.icons.delete(endKey);
                    }
                }
            }
        });
    }

    /**
     * Updates all icon positions (useful when content changes)
     */
    updatePositions() {
        this.icons.forEach((icon, lineNumber) => {
            const lineElement = this.gutter.querySelector(`span:nth-child(${lineNumber})`);
            if (lineElement) {
                icon.style.top = `${lineElement.offsetTop}px`;
            } else {
                const fontSize = parseFloat(getComputedStyle(this.gutter).fontSize);
                const lineHeight = fontSize * 1.5;
                const padding = 10;
                icon.style.top = `${(lineNumber - 1) * lineHeight + padding}px`;
            }
        });
    }

    /**
     * Clears all icons
     */
    clear() {
        this.icons.forEach(icon => icon.remove());
        this.icons.clear();
    }

    /**
     * Builds tooltip text
     */
    buildTooltip(userName, changeType, metadata) {
        let tooltip = '';
        if (metadata.range) {
            tooltip = `${userName} ${changeType === 'added' ? 'added' : 'edited'} lines ${metadata.range.start}-${metadata.range.end}`;
        } else {
            tooltip = `${userName} ${changeType === 'added' ? 'added' : 'edited'} this line`;
        }
        if (metadata.lockDuration) {
            tooltip += `\nLocked for: ${metadata.lockDuration}`;
        }
        if (metadata.timestamp) {
            const date = new Date(metadata.timestamp);
            tooltip += `\nAt: ${date.toLocaleTimeString()}`;
        }
        return tooltip;
    }

    /**
     * Adjusts icons when content changes
     */
    adjustByContent(oldLines, newLines) {
        const iconsToUpdate = [];

        this.icons.forEach((icon, lineNumber) => {
            if (lineNumber <= oldLines.length) {
                const oldLineContent = oldLines[lineNumber - 1];
                const newLineIndex = newLines.findIndex(line => line === oldLineContent);
                if (newLineIndex !== -1) {
                    const newLineNumber = newLineIndex + 1;
                    if (newLineNumber !== lineNumber) {
                        iconsToUpdate.push({
                            icon,
                            oldLine: lineNumber,
                            newLine: newLineNumber
                        });
                    }
                }
            }
        });

        // Update icon line numbers
        iconsToUpdate.forEach(({ icon, oldLine, newLine }) => {
            this.icons.delete(oldLine);
            icon.dataset.line = newLine;
            this.icons.set(newLine, icon);
        });

        // Update positions
        if (iconsToUpdate.length > 0) {
            this.updatePositions();
        }
    }
}

