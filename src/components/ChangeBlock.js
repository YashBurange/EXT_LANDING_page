/**
 * ChangeBlock Component
 * Manages collaborative change blocks showing uncommitted changes from other users
 */
export class ChangeBlock {
    constructor(editorElement, options = {}) {
        this.editor = editorElement;
        this.blocks = new Map(); // Track blocks by block ID
        this.userColors = options.userColors || {
            'User A': '#00ff99',
            'User B': '#bd93f9'
        };
        this.onBlockClick = options.onBlockClick || (() => { });
        this.onInsertBefore = options.onInsertBefore || (() => { });
        this.onInsertAfter = options.onInsertAfter || (() => { });
        this.onInsertBetween = options.onInsertBetween || (() => { });
    }

    /**
     * Creates a change block for uncommitted changes
     * @param {string} blockId - Unique identifier for this block
     * @param {number} startLine - Starting line number (1-indexed)
     * @param {number} endLine - Ending line number (1-indexed)
     * @param {string} userName - Name of the user who made the changes
     * @param {Array<string>} changes - Array of changed line contents
     * @param {string} changeType - 'added' or 'edited'
     */
    create(blockId, startLine, endLine, userName, changes, changeType = 'added') {
        // Remove existing block if any
        this.remove(blockId);

        const block = document.createElement('div');
        block.className = `change-block collapsed ${changeType}`;
        block.dataset.blockId = blockId;
        block.dataset.userName = userName;
        block.dataset.startLine = startLine;
        block.dataset.endLine = endLine;
        block.dataset.changeType = changeType;

        const color = this.userColors[userName] || this.userColors['User A'];
        block.style.borderColor = color;
        block.style.backgroundColor = `${color}15`;

        // Create collapsed indicator
        const indicator = document.createElement('div');
        indicator.className = 'change-block-indicator';
        indicator.innerHTML = `
            <span class="block-label">${userName} has ${changes.length} uncommitted ${changes.length === 1 ? 'change' : 'changes'}</span>
        `;

        // Create preview dropdown (hidden by default)
        const preview = document.createElement('div');
        preview.className = 'change-block-preview';
        preview.style.display = 'none';

        const previewHeader = document.createElement('div');
        previewHeader.className = 'preview-header';
        previewHeader.innerHTML = `
            <span class="preview-user">${userName}'s changes:</span>
            <button class="preview-close">×</button>
        `;

        const previewContent = document.createElement('div');
        previewContent.className = 'preview-content';
        changes.forEach((line, index) => {
            const lineDiv = document.createElement('div');
            lineDiv.className = 'preview-line';
            lineDiv.textContent = line || '(empty line)';
            previewContent.appendChild(lineDiv);
        });

        preview.appendChild(previewHeader);
        preview.appendChild(previewContent);

        // Create insertion options
        const insertionOptions = document.createElement('div');
        insertionOptions.className = 'insertion-options';
        insertionOptions.style.display = 'none';

        const insertBeforeBtn = document.createElement('button');
        insertBeforeBtn.className = 'insert-btn insert-before';
        insertBeforeBtn.textContent = 'Insert Before';
        insertBeforeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onInsertBefore(blockId, startLine);
        });

        const insertAfterBtn = document.createElement('button');
        insertAfterBtn.className = 'insert-btn insert-after';
        insertAfterBtn.textContent = 'Insert After';
        insertAfterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onInsertAfter(blockId, endLine);
        });

        // Only show "Insert Between" if there are multiple changes
        if (changes.length > 1) {
            const insertBetweenBtn = document.createElement('button');
            insertBetweenBtn.className = 'insert-btn insert-between';
            insertBetweenBtn.textContent = 'Insert Between';
            insertBetweenBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const midLine = Math.floor((startLine + endLine) / 2);
                this.onInsertBetween(blockId, startLine, midLine, endLine);
            });
            insertionOptions.appendChild(insertBetweenBtn);
        }

        insertionOptions.appendChild(insertBeforeBtn);
        insertionOptions.appendChild(insertAfterBtn);

        block.appendChild(indicator);
        block.appendChild(preview);
        block.appendChild(insertionOptions);

        // Position the block
        this.updateBlockPosition(block, startLine, endLine);

        // Add click handler to toggle preview
        indicator.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePreview(blockId);
        });

        // Close preview button
        previewHeader.querySelector('.preview-close').addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePreview(blockId);
        });

        // Show insertion options on hover
        block.addEventListener('mouseenter', () => {
            insertionOptions.style.display = 'flex';
        });

        block.addEventListener('mouseleave', () => {
            if (!preview.style.display || preview.style.display === 'none') {
                insertionOptions.style.display = 'none';
            }
        });

        // Insert block in the window body (same container as marker layer)
        const windowBody = this.editor.closest('.window-body');
        if (windowBody) {
            // Insert before marker layer so markers appear on top
            const markerLayer = windowBody.querySelector('.marker-layer');
            if (markerLayer) {
                windowBody.insertBefore(block, markerLayer);
            } else {
                windowBody.appendChild(block);
            }
        } else {
            // Fallback: insert after editor
            const editorContainer = this.editor.parentElement;
            if (editorContainer) {
                editorContainer.appendChild(block);
            }
        }

        this.blocks.set(blockId, {
            element: block,
            startLine,
            endLine,
            userName,
            changes,
            changeType
        });
    }

    /**
     * Toggles the preview dropdown for a block
     */
    togglePreview(blockId) {
        const blockData = this.blocks.get(blockId);
        if (!blockData) return;

        const preview = blockData.element.querySelector('.change-block-preview');
        const insertionOptions = blockData.element.querySelector('.insertion-options');

        if (preview.style.display === 'none' || !preview.style.display) {
            preview.style.display = 'block';
            insertionOptions.style.display = 'flex';
            blockData.element.classList.remove('collapsed');
            blockData.element.classList.add('expanded');
        } else {
            preview.style.display = 'none';
            insertionOptions.style.display = 'none';
            blockData.element.classList.remove('expanded');
            blockData.element.classList.add('collapsed');
        }
    }

    /**
     * Splits a block into two parts when inserting between
     */
    split(blockId, splitLine) {
        const blockData = this.blocks.get(blockId);
        if (!blockData) return null;

        const { startLine, endLine, userName, changes, changeType } = blockData;

        if (splitLine <= startLine || splitLine >= endLine) {
            return null; // Invalid split
        }

        // Calculate split point in changes array
        const relativeSplit = splitLine - startLine;
        const firstPartChanges = changes.slice(0, relativeSplit);
        const secondPartChanges = changes.slice(relativeSplit);

        // Create two new blocks
        const firstBlockId = `${blockId}-part1`;
        const secondBlockId = `${blockId}-part2`;

        this.create(firstBlockId, startLine, splitLine - 1, userName, firstPartChanges, changeType);
        this.create(secondBlockId, splitLine, endLine, userName, secondPartChanges, changeType);

        // Remove original block
        this.remove(blockId);

        return { firstBlockId, secondBlockId };
    }

    /**
     * Removes a change block
     */
    remove(blockId) {
        const blockData = this.blocks.get(blockId);
        if (blockData) {
            blockData.element.remove();
            this.blocks.delete(blockId);
        }
    }

    /**
     * Updates block position
     */
    updateBlockPosition(block, startLine, endLine) {
        const editor = this.editor;
        const fontSize = parseFloat(getComputedStyle(editor).fontSize);
        const lineHeight = fontSize * 1.5;
        const padding = 10;

        const startTop = (startLine - 1) * lineHeight + padding;
        const endTop = (endLine - 1) * lineHeight + padding;
        const height = endTop - startTop + lineHeight;

        block.style.top = `${startTop}px`;
        block.style.height = `${height}px`;
    }

    /**
     * Updates all block positions
     */
    updatePositions() {
        this.blocks.forEach((blockData) => {
            this.updateBlockPosition(blockData.element, blockData.startLine, blockData.endLine);
        });
    }

    /**
     * Clears all blocks
     */
    clear() {
        this.blocks.forEach((blockData) => blockData.element.remove());
        this.blocks.clear();
    }

    /**
     * Adjusts blocks when content changes
     */
    adjustByContent(oldLines, newLines) {
        const blocksToUpdate = [];

        this.blocks.forEach((blockData, blockId) => {
            // Try to find the block's content in new lines
            const firstChange = blockData.changes[0];
            const newStartIndex = newLines.findIndex(line => line === firstChange);

            if (newStartIndex !== -1) {
                const newStartLine = newStartIndex + 1;
                const newEndLine = newStartLine + blockData.changes.length - 1;

                if (newStartLine !== blockData.startLine || newEndLine !== blockData.endLine) {
                    blocksToUpdate.push({
                        blockId,
                        newStartLine,
                        newEndLine
                    });
                }
            }
        });

        // Update block positions
        blocksToUpdate.forEach(({ blockId, newStartLine, newEndLine }) => {
            const blockData = this.blocks.get(blockId);
            if (blockData) {
                blockData.startLine = newStartLine;
                blockData.endLine = newEndLine;
                blockData.element.dataset.startLine = newStartLine;
                blockData.element.dataset.endLine = newEndLine;
                this.updateBlockPosition(blockData.element, newStartLine, newEndLine);
            }
        });
    }
}

