import { CodeEditor } from '../components/CodeEditor.js';
import { Marker } from '../components/Marker.js';
import { StatusIndicator } from '../components/StatusIndicator.js';
import { GutterIcons } from '../components/GutterIcons.js';
import { ChangeBlock } from '../components/ChangeBlock.js';

// Shared state to simulate git repository (stores code and changes)
const gitRepository = {
    userA: {
        content: null,
        changes: [], // Array of {lineContent, lineNumber, changeType: 'added'|'edited'}
        uncommittedBlocks: [] // Array of {blockId, startLine, endLine, changes}
    },
    userB: {
        content: null,
        changes: [],
        uncommittedBlocks: []
    }
};

/**
 * Real-time Collaboration Hook
 * Sets up the real-time collaboration demo with two editors
 */
export function useRealTimeCollaboration() {
    // Editor A setup
    const editorA = document.getElementById('editor-a');
    const markerLayerA = document.getElementById('marker-layer-a');
    const lineNumbersA = document.getElementById('line-numbers-a');
    const statusA = document.getElementById('status-a');
    const gitPullA = document.getElementById('git-pull-a');
    const gitPushA = document.getElementById('git-push-a');

    // Editor B setup
    const editorB = document.getElementById('editor-b');
    const markerLayerB = document.getElementById('marker-layer-b');
    const lineNumbersB = document.getElementById('line-numbers-b');
    const statusB = document.getElementById('status-b');
    const gitPullB = document.getElementById('git-pull-b');
    const gitPushB = document.getElementById('git-push-b');

    if (!editorA || !editorB) {
        console.warn('Editor elements not found');
        return;
    }

    // Create markers
    const markerA = new Marker(markerLayerB, { userClass: 'user-a' });
    const markerB = new Marker(markerLayerA, { userClass: 'user-b' });

    // Create gutter icons
    const gutterIconsA = new GutterIcons(lineNumbersA, {
        userColors: {
            'User A': '#00ff99',
            'User B': '#bd93f9'
        },
        userAvatars: {
            'User A': 'A',
            'User B': 'B'
        }
    });

    const gutterIconsB = new GutterIcons(lineNumbersB, {
        userColors: {
            'User A': '#00ff99',
            'User B': '#bd93f9'
        },
        userAvatars: {
            'User A': 'A',
            'User B': 'B'
        }
    });

    // Create change blocks
    const changeBlocksA = new ChangeBlock(editorA, {
        userColors: {
            'User A': '#00ff99',
            'User B': '#bd93f9'
        }
    });

    const changeBlocksB = new ChangeBlock(editorB, {
        userColors: {
            'User A': '#00ff99',
            'User B': '#bd93f9'
        }
    });

    // Create status indicators
    const statusIndicatorA = new StatusIndicator(statusA, {
        status: 'active',
        activeCollaborators: ['User B']
    });
    const statusIndicatorB = new StatusIndicator(statusB, {
        status: 'active',
        activeCollaborators: ['User A']
    });

    // Track changes by line content
    const changesA = new Map();
    const changesB = new Map();

    // Track edit reservations (territory claiming)
    const reservationsA = new Map(); // lineNumber -> {userName, timestamp}
    const reservationsB = new Map();

    // Track baseline content for each editor
    let baselineContentA = '';
    let baselineContentB = '';

    // Track previous line counts for range detection
    let previousLineCountA = 0;
    let previousLineCountB = 0;

    // Track recent additions for range detection
    let recentAdditionsA = []; // Array of {line, content, timestamp}
    let recentAdditionsB = [];

    // Track recent edits for range detection
    let recentEditsA = []; // Array of {line, content, timestamp}
    let recentEditsB = [];

    // Track uncommitted change blocks
    let uncommittedBlocksA = []; // Array of {blockId, startLine, endLine, changes, changeType}
    let uncommittedBlocksB = [];

    // Helper: Check for overlap/conflicts
    function checkOverlap(lineNumber, userName, reservations) {
        const reservation = reservations.get(lineNumber);
        if (reservation && reservation.userName !== userName) {
            return {
                hasConflict: true,
                conflictingUser: reservation.userName,
                timestamp: reservation.timestamp
            };
        }
        return { hasConflict: false };
    }

    // Helper: Reserve territory (edit reservation)
    function reserveTerritory(lineNumber, userName, reservations) {
        reservations.set(lineNumber, {
            userName,
            timestamp: Date.now()
        });
    }

    // Helper: Detect and handle range insertions
    function detectRangeInsertion(currentLine, content, baselineContent, previousLineCount, recentAdditions, userName, marker, gutterIcons, changes, reservations) {
        const currentLines = content.split('\n');
        const baselineLines = baselineContent ? baselineContent.split('\n') : [];
        const currentLineCount = currentLines.length;

        // Check if we're inserting between existing lines (not at the end)
        // If currentLine is less than or equal to the baseline length, it's an insertion
        const isInsertionBetween = baselineContent && baselineLines.length > 0 && currentLine <= baselineLines.length;

        // Add to recent additions
        const addition = {
            line: currentLine,
            content: currentLines[currentLine - 1] || '',
            timestamp: Date.now()
        };
        recentAdditions.push(addition);

        // Clean old additions (older than 500ms)
        const now = Date.now();
        const recent = recentAdditions.filter(a => now - a.timestamp < 500);
        recentAdditions.length = 0;
        recentAdditions.push(...recent);

        // Check if we have consecutive additions that form a range
        if (recent.length > 1) {
            // Sort by line number
            recent.sort((a, b) => a.line - b.line);

            // Check if they're consecutive
            let rangeStart = recent[0].line;
            let rangeEnd = recent[0].line;
            const consecutive = [];

            for (let i = 0; i < recent.length; i++) {
                if (i === 0 || recent[i].line === recent[i - 1].line + 1) {
                    consecutive.push(recent[i]);
                    rangeEnd = recent[i].line;
                } else {
                    break;
                }
            }

            // If we have a range of 2+ consecutive lines
            if (consecutive.length >= 2 && rangeEnd > rangeStart) {
                // Check if this is an insertion between existing lines
                // We check if the range start is before or at the original baseline length
                if (isInsertionBetween && rangeStart <= baselineLines.length + 1) {
                    // This is a range insertion between existing lines
                    // Reserve all lines in range
                    for (let line = rangeStart; line <= rangeEnd; line++) {
                        reserveTerritory(line, userName, reservations);
                    }

                    // Track all changes in range
                    consecutive.forEach((add) => {
                        const changeData = {
                            changeType: 'added',
                            userName: userName,
                            lineNumber: add.line,
                            lineContent: add.content,
                            timestamp: add.timestamp
                        };
                        changes.set(add.line, changeData);
                    });

                    // Show range marker
                    marker.show(rangeStart, userName, true, 'added', rangeEnd);
                    gutterIcons.show(rangeStart, userName, 'added', {
                        timestamp: Date.now()
                    }, rangeEnd);

                    // Clear recent additions since we've processed the range
                    recentAdditions.length = 0;

                    return {
                        isRange: true,
                        startLine: rangeStart,
                        endLine: rangeEnd,
                        shiftAmount: rangeEnd - rangeStart + 1
                    };
                }
            }
        }

        // Single line addition
        return { isRange: false };
    }

    // Helper: Detect and handle range edits
    function detectRangeEdit(currentLine, content, baselineContent, previousLineCount, recentEdits, userName, marker, gutterIcons, changes, reservations) {
        const currentLines = content.split('\n');
        const baselineLines = baselineContent ? baselineContent.split('\n') : [];

        // Add to recent edits
        const edit = {
            line: currentLine,
            content: currentLines[currentLine - 1] || '',
            timestamp: Date.now()
        };
        recentEdits.push(edit);

        // Clean old edits (older than 500ms)
        const now = Date.now();
        const recent = recentEdits.filter(e => now - e.timestamp < 500);
        recentEdits.length = 0;
        recentEdits.push(...recent);

        // Check if we have consecutive edits that form a range
        if (recent.length > 1) {
            // Sort by line number
            recent.sort((a, b) => a.line - b.line);

            // Check if they're consecutive
            let rangeStart = recent[0].line;
            let rangeEnd = recent[0].line;
            const consecutive = [];

            for (let i = 0; i < recent.length; i++) {
                if (i === 0 || recent[i].line === recent[i - 1].line + 1) {
                    consecutive.push(recent[i]);
                    rangeEnd = recent[i].line;
                } else {
                    break;
                }
            }

            // If we have a range of 2+ consecutive lines
            if (consecutive.length >= 2 && rangeEnd > rangeStart) {
                // Reserve all lines in range
                for (let line = rangeStart; line <= rangeEnd; line++) {
                    reserveTerritory(line, userName, reservations);
                }

                // Track all changes in range
                consecutive.forEach((editItem) => {
                    const changeData = {
                        changeType: 'edited',
                        userName: userName,
                        lineNumber: editItem.line,
                        lineContent: editItem.content,
                        timestamp: editItem.timestamp
                    };
                    changes.set(editItem.line, changeData);
                });

                // Remove individual markers in the range
                for (let line = rangeStart; line <= rangeEnd; line++) {
                    const markerKey = line;
                    if (marker.persistentMarkers.has(markerKey)) {
                        const existingMarker = marker.persistentMarkers.get(markerKey);
                        existingMarker.remove();
                        marker.persistentMarkers.delete(markerKey);
                    }
                }

                // Show range marker
                marker.show(rangeStart, userName, true, 'edited', rangeEnd);
                gutterIcons.show(rangeStart, userName, 'edited', {
                    timestamp: Date.now()
                }, rangeEnd);

                // Clear recent edits since we've processed the range
                recentEdits.length = 0;

                return {
                    isRange: true,
                    startLine: rangeStart,
                    endLine: rangeEnd
                };
            }
        }

        // Single line edit
        return { isRange: false };
    }

    // Helper: Consolidate existing markers into ranges
    function consolidateMarkersIntoRanges(marker, gutterIcons, userName, changeType) {
        const markers = Array.from(marker.persistentMarkers.entries())
            .filter(([key, m]) => {
                // Only process single-line markers (not already ranges)
                return typeof key === 'number' && !m.dataset.endLine;
            })
            .map(([line, m]) => ({ line: parseInt(line), marker: m }))
            .sort((a, b) => a.line - b.line);

        if (markers.length < 2) return;

        // Find consecutive ranges
        let rangeStart = markers[0].line;
        let rangeEnd = markers[0].line;
        const ranges = [];

        for (let i = 1; i < markers.length; i++) {
            if (markers[i].line === markers[i - 1].line + 1) {
                // Consecutive
                rangeEnd = markers[i].line;
            } else {
                // Break in sequence
                if (rangeEnd > rangeStart) {
                    ranges.push({ start: rangeStart, end: rangeEnd });
                }
                rangeStart = markers[i].line;
                rangeEnd = markers[i].line;
            }
        }

        // Add final range
        if (rangeEnd > rangeStart) {
            ranges.push({ start: rangeStart, end: rangeEnd });
        }

        // Replace individual markers with range markers
        ranges.forEach(({ start, end }) => {
            // Remove individual markers in range
            for (let line = start; line <= end; line++) {
                const existingMarker = marker.persistentMarkers.get(line);
                if (existingMarker) {
                    existingMarker.remove();
                    marker.persistentMarkers.delete(line);
                }
                // Also remove gutter icons
                gutterIcons.hide(line);
            }

            // Create range marker
            marker.show(start, userName, true, changeType, end);
            gutterIcons.show(start, userName, changeType, {
                timestamp: Date.now()
            }, end);
        });
    }

    // Helper: Create change block from uncommitted changes
    function createChangeBlocks(changes, userName) {
        if (changes.length === 0) return [];

        // Sort changes by line number
        const sortedChanges = [...changes].sort((a, b) => a.lineNumber - b.lineNumber);

        // Group consecutive changes into blocks
        const blocks = [];
        let currentBlock = null;

        sortedChanges.forEach((change) => {
            if (!currentBlock) {
                currentBlock = {
                    blockId: `${userName}-block-${Date.now()}-${blocks.length}`,
                    startLine: change.lineNumber,
                    endLine: change.lineNumber,
                    changes: [change.lineContent],
                    changeType: change.changeType
                };
            } else if (change.lineNumber === currentBlock.endLine + 1) {
                // Consecutive line - consolidate regardless of changeType
                currentBlock.endLine = change.lineNumber;
                currentBlock.changes.push(change.lineContent);
                // Keep the first changeType, or use 'edited' as default for mixed blocks
                if (currentBlock.changeType !== change.changeType) {
                    currentBlock.changeType = 'edited'; // Use 'edited' for mixed blocks
                }
            } else {
                // New block (gap in line numbers)
                blocks.push(currentBlock);
                currentBlock = {
                    blockId: `${userName}-block-${Date.now()}-${blocks.length}`,
                    startLine: change.lineNumber,
                    endLine: change.lineNumber,
                    changes: [change.lineContent],
                    changeType: change.changeType
                };
            }
        });

        if (currentBlock) {
            blocks.push(currentBlock);
        }

        return blocks;
    }

    // Create editors
    const codeEditorA = new CodeEditor(editorA, lineNumbersA, {
        onLineAdded: (line) => {
            const content = codeEditorA.getContent();

            // Detect range insertion
            const rangeResult = detectRangeInsertion(
                line, content, baselineContentA, previousLineCountA, recentAdditionsA,
                'User A', markerA, gutterIconsA, changesA, reservationsA
            );

            if (!rangeResult.isRange) {
                // Single line addition
                const lines = content.split('\n');
                const lineContent = lines[line - 1] || '';

                // Check for overlap
                const overlap = checkOverlap(line, 'User A', reservationsB);
                if (overlap.hasConflict) {
                    console.warn(`Conflict detected: User A trying to edit line ${line} reserved by ${overlap.conflictingUser}`);
                }

                // Reserve territory
                reserveTerritory(line, 'User A', reservationsA);

                // Track change
                const changeData = {
                    changeType: 'added',
                    userName: 'User A',
                    lineNumber: line,
                    lineContent: lineContent,
                    timestamp: Date.now()
                };
                changesA.set(line, changeData);

                // Show marker and gutter icon
                console.log('User A: Showing marker for line', line);
                markerA.show(line, 'User A', true, 'added');
                gutterIconsA.show(line, 'User A', 'added', {
                    timestamp: Date.now()
                });
            }

            // Update previous line count
            previousLineCountA = codeEditorA.getLineCount();

            // Consolidate markers into ranges after a delay
            setTimeout(() => {
                consolidateMarkersIntoRanges(markerA, gutterIconsA, 'User A', 'added');
                markerA.updatePosition();
                gutterIconsA.updatePositions();
            }, 100);

            // Highlight the line
            highlightLine(editorA, line, 'added', 'User A');

            // Adjust other user's markers
            adjustMarkersForContentChange(markerB, baselineContentB, content);
            adjustMarkersForContentChange(gutterIconsB, baselineContentB, content);
            adjustMarkersForContentChange(changeBlocksB, baselineContentB, content);
        },
        onLineEdited: (line) => {
            const content = codeEditorA.getContent();

            // Detect range edit
            const rangeResult = detectRangeEdit(
                line, content, baselineContentA, previousLineCountA, recentEditsA,
                'User A', markerA, gutterIconsA, changesA, reservationsA
            );

            if (!rangeResult.isRange) {
                // Single line edit
                const lines = content.split('\n');
                const lineContent = lines[line - 1] || '';

                // Check for overlap
                const overlap = checkOverlap(line, 'User A', reservationsB);
                if (overlap.hasConflict) {
                    console.warn(`Conflict detected: User A trying to edit line ${line} reserved by ${overlap.conflictingUser}`);
                }

                // Reserve territory
                reserveTerritory(line, 'User A', reservationsA);

                // Track change
                const changeData = {
                    changeType: 'edited',
                    userName: 'User A',
                    lineNumber: line,
                    lineContent: lineContent,
                    timestamp: Date.now()
                };
                changesA.set(line, changeData);

                // Show marker and gutter icon
                console.log('User A: Showing marker for edited line', line);
                markerA.show(line, 'User A', true, 'edited');
                gutterIconsA.show(line, 'User A', 'edited', {
                    timestamp: Date.now()
                });
            }

            // Consolidate markers into ranges after a delay
            setTimeout(() => {
                consolidateMarkersIntoRanges(markerA, gutterIconsA, 'User A', 'edited');
                markerA.updatePosition();
                gutterIconsA.updatePositions();
            }, 100);

            // Highlight the line
            highlightLine(editorA, line, 'edited', 'User A');

            // Adjust other user's markers
            adjustMarkersForContentChange(markerB, baselineContentB, content);
            adjustMarkersForContentChange(gutterIconsB, baselineContentB, content);
            adjustMarkersForContentChange(changeBlocksB, baselineContentB, content);
        },
        onContentChange: () => {
            const content = codeEditorA.getContent();
            adjustMarkersForContentChange(markerB, baselineContentA, content);
            adjustMarkersForContentChange(gutterIconsB, baselineContentA, content);
            adjustMarkersForContentChange(changeBlocksB, baselineContentA, content);
            baselineContentA = content;
            previousLineCountA = codeEditorA.getLineCount();

            // Update positions
            setTimeout(() => {
                gutterIconsA.updatePositions();
                changeBlocksA.updatePositions();
            }, 50);
        }
    });

    const codeEditorB = new CodeEditor(editorB, lineNumbersB, {
        onLineAdded: (line) => {
            const content = codeEditorB.getContent();

            // Detect range insertion
            const rangeResult = detectRangeInsertion(
                line, content, baselineContentB, previousLineCountB, recentAdditionsB,
                'User B', markerB, gutterIconsB, changesB, reservationsB
            );

            if (!rangeResult.isRange) {
                // Single line addition
                const lines = content.split('\n');
                const lineContent = lines[line - 1] || '';

                // Check for overlap
                const overlap = checkOverlap(line, 'User B', reservationsA);
                if (overlap.hasConflict) {
                    console.warn(`Conflict detected: User B trying to edit line ${line} reserved by ${overlap.conflictingUser}`);
                }

                // Reserve territory
                reserveTerritory(line, 'User B', reservationsB);

                // Track change
                const changeData = {
                    changeType: 'added',
                    userName: 'User B',
                    lineNumber: line,
                    lineContent: lineContent,
                    timestamp: Date.now()
                };
                changesB.set(line, changeData);

                // Show marker and gutter icon
                console.log('User B: Showing marker for line', line);
                markerB.show(line, 'User B', true, 'added');
                gutterIconsB.show(line, 'User B', 'added', {
                    timestamp: Date.now()
                });
            }

            // Update previous line count
            previousLineCountB = codeEditorB.getLineCount();

            // Consolidate markers into ranges after a delay
            setTimeout(() => {
                consolidateMarkersIntoRanges(markerB, gutterIconsB, 'User B', 'added');
                markerB.updatePosition();
                gutterIconsB.updatePositions();
            }, 100);

            // Highlight the line
            highlightLine(editorB, line, 'added', 'User B');

            // Adjust other user's markers
            adjustMarkersForContentChange(markerA, baselineContentA, content);
            adjustMarkersForContentChange(gutterIconsA, baselineContentA, content);
            adjustMarkersForContentChange(changeBlocksA, baselineContentA, content);
        },
        onLineEdited: (line) => {
            const content = codeEditorB.getContent();

            // Detect range edit
            const rangeResult = detectRangeEdit(
                line, content, baselineContentB, previousLineCountB, recentEditsB,
                'User B', markerB, gutterIconsB, changesB, reservationsB
            );

            if (!rangeResult.isRange) {
                // Single line edit
                const lines = content.split('\n');
                const lineContent = lines[line - 1] || '';

                // Check for overlap
                const overlap = checkOverlap(line, 'User B', reservationsA);
                if (overlap.hasConflict) {
                    console.warn(`Conflict detected: User B trying to edit line ${line} reserved by ${overlap.conflictingUser}`);
                }

                // Reserve territory
                reserveTerritory(line, 'User B', reservationsB);

                // Track change
                const changeData = {
                    changeType: 'edited',
                    userName: 'User B',
                    lineNumber: line,
                    lineContent: lineContent,
                    timestamp: Date.now()
                };
                changesB.set(line, changeData);

                // Show marker and gutter icon
                console.log('User B: Showing marker for edited line', line);
                markerB.show(line, 'User B', true, 'edited');
                gutterIconsB.show(line, 'User B', 'edited', {
                    timestamp: Date.now()
                });
            }

            // Consolidate markers into ranges after a delay
            setTimeout(() => {
                consolidateMarkersIntoRanges(markerB, gutterIconsB, 'User B', 'edited');
                markerB.updatePosition();
                gutterIconsB.updatePositions();
            }, 100);

            // Highlight the line
            highlightLine(editorB, line, 'edited', 'User B');

            // Adjust other user's markers
            adjustMarkersForContentChange(markerA, baselineContentA, content);
            adjustMarkersForContentChange(gutterIconsA, baselineContentA, content);
            adjustMarkersForContentChange(changeBlocksA, baselineContentA, content);
        },
        onContentChange: () => {
            const content = codeEditorB.getContent();
            adjustMarkersForContentChange(markerA, baselineContentB, content);
            adjustMarkersForContentChange(gutterIconsA, baselineContentB, content);
            adjustMarkersForContentChange(changeBlocksA, baselineContentB, content);
            baselineContentB = content;
            previousLineCountB = codeEditorB.getLineCount();

            // Update positions
            setTimeout(() => {
                gutterIconsB.updatePositions();
                changeBlocksB.updatePositions();
            }, 50);
        }
    });

    // Initialize previous line count for editor B
    previousLineCountB = codeEditorB.getLineCount();

    // Initialize baselines
    baselineContentA = codeEditorA.getContent();
    baselineContentB = codeEditorB.getContent();

    // Set up change block insertion handlers
    changeBlocksA.onInsertBefore = (blockId, line) => {
        console.log('User A: Insert before block', blockId, 'at line', line);
        // Focus editor and position cursor
        editorA.focus();
    };

    changeBlocksA.onInsertAfter = (blockId, line) => {
        console.log('User A: Insert after block', blockId, 'at line', line);
        editorA.focus();
    };

    changeBlocksA.onInsertBetween = (blockId, startLine, midLine, endLine) => {
        console.log('User A: Insert between block', blockId, 'splitting at', midLine);
        // Split the block
        changeBlocksA.split(blockId, midLine);
        editorA.focus();
    };

    changeBlocksB.onInsertBefore = (blockId, line) => {
        console.log('User B: Insert before block', blockId, 'at line', line);
        editorB.focus();
    };

    changeBlocksB.onInsertAfter = (blockId, line) => {
        console.log('User B: Insert after block', blockId, 'at line', line);
        editorB.focus();
    };

    changeBlocksB.onInsertBetween = (blockId, startLine, midLine, endLine) => {
        console.log('User B: Insert between block', blockId, 'splitting at', midLine);
        changeBlocksB.split(blockId, midLine);
        editorB.focus();
    };

    // Git Push for User A
    if (gitPushA) {
        gitPushA.addEventListener('click', () => {
            const content = codeEditorA.getContent();
            const changes = Array.from(changesA.values()).map(change => ({
                lineContent: change.lineContent,
                lineNumber: change.lineNumber,
                changeType: change.changeType,
                userName: 'User A'
            }));

            gitRepository.userA.content = content;
            gitRepository.userA.changes = changes;
            gitRepository.userA.uncommittedBlocks = uncommittedBlocksA;

            // Create uncommitted blocks for User A
            const changesArrayA = Array.from(changesA.values());
            const blocksA = createChangeBlocks(changesArrayA, 'User A');
            uncommittedBlocksA = blocksA;

            // Clear existing blocks before showing new consolidated ones
            changeBlocksB.clear();

            // Show change blocks in User B's editor
            uncommittedBlocksA.forEach(block => {
                changeBlocksB.create(
                    block.blockId,
                    block.startLine,
                    block.endLine,
                    'User A',
                    block.changes,
                    block.changeType
                );
            });

            // Update baseline
            baselineContentA = content;

            console.log('User A pushed:', { content, changes, blocks: uncommittedBlocksA });
        });
    }

    // Git Pull for User A
    if (gitPullA) {
        gitPullA.addEventListener('click', () => {
            if (!gitRepository.userB.content) {
                console.log('No content to pull from User B');
                return;
            }

            const originalContent = codeEditorA.getContent();
            const mergedContent = mergeCode(originalContent, gitRepository.userB.content);
            codeEditorA.setContent(mergedContent);

            // Clear change blocks (changes are now merged)
            changeBlocksA.clear();

            // Update positions
            setTimeout(() => {
                markerB.updatePosition();
                gutterIconsA.updatePositions();
                markerB.clearPersistentMarkers();
            }, 100);

            // Clear User B's repository
            gitRepository.userB.content = null;
            gitRepository.userB.changes = [];
            gitRepository.userB.uncommittedBlocks = [];
            baselineContentA = mergedContent;

            console.log('User A pulled from User B');
        });
    }

    // Git Push for User B
    if (gitPushB) {
        gitPushB.addEventListener('click', () => {
            const content = codeEditorB.getContent();
            const changes = Array.from(changesB.values()).map(change => ({
                lineContent: change.lineContent,
                lineNumber: change.lineNumber,
                changeType: change.changeType,
                userName: 'User B'
            }));

            // Create uncommitted blocks
            const changesArray = Array.from(changesB.values());
            const blocks = createChangeBlocks(changesArray, 'User B');
            uncommittedBlocksB = blocks;

            gitRepository.userB.content = content;
            gitRepository.userB.changes = changes;
            gitRepository.userB.uncommittedBlocks = uncommittedBlocksB;

            // Clear existing blocks before showing new consolidated ones
            changeBlocksA.clear();

            // Show change blocks in User A's editor
            uncommittedBlocksB.forEach(block => {
                changeBlocksA.create(
                    block.blockId,
                    block.startLine,
                    block.endLine,
                    'User B',
                    block.changes,
                    block.changeType
                );
            });

            // Update baseline
            baselineContentB = content;

            console.log('User B pushed:', { content, changes, blocks: uncommittedBlocksB });
        });
    }

    // Git Pull for User B
    if (gitPullB) {
        gitPullB.addEventListener('click', () => {
            if (!gitRepository.userA.content) {
                console.log('No content to pull from User A');
                return;
            }

            const originalContent = codeEditorB.getContent();
            const mergedContent = mergeCode(originalContent, gitRepository.userA.content);
            codeEditorB.setContent(mergedContent);

            // Clear change blocks
            changeBlocksB.clear();

            // Update positions
            setTimeout(() => {
                markerA.updatePosition();
                gutterIconsB.updatePositions();
                markerA.clearPersistentMarkers();
            }, 100);

            // Clear User A's repository
            gitRepository.userA.content = null;
            gitRepository.userA.changes = [];
            gitRepository.userA.uncommittedBlocks = [];
            baselineContentB = mergedContent;

            console.log('User B pulled from User A');
        });
    }

    return {
        editorA: codeEditorA,
        editorB: codeEditorB,
        markerA,
        markerB,
        gutterIconsA,
        gutterIconsB,
        changeBlocksA,
        changeBlocksB
    };
}

/**
 * Highlights a line based on change type
 */
function highlightLine(editor, lineNumber, changeType, userName) {
    // Remove existing highlights
    const existingHighlights = editor.querySelectorAll(`[data-highlight-line="${lineNumber}"]`);
    existingHighlights.forEach(el => el.remove());

    // This would require more complex DOM manipulation to highlight specific lines
    // For now, we rely on markers and gutter icons for visual indication
    // A full implementation would wrap lines in spans with highlight classes
}

/**
 * Adjusts markers/icons/blocks when content changes
 */
function adjustMarkersForContentChange(component, oldContent, newContent) {
    if (!oldContent || !newContent || !component) return;

    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    if (component.adjustByContent) {
        component.adjustByContent(oldLines, newLines);
    } else if (component.updatePositions) {
        component.updatePositions();
    }
}

/**
 * Merges code from source into target
 */
function mergeCode(targetContent, sourceContent) {
    const targetLines = targetContent.split('\n');
    const sourceLines = sourceContent.split('\n');

    const maxLines = Math.max(targetLines.length, sourceLines.length);
    const mergedLines = [];

    for (let i = 0; i < maxLines; i++) {
        if (i < targetLines.length && i < sourceLines.length) {
            if (targetLines[i] !== sourceLines[i]) {
                mergedLines.push(sourceLines[i]);
            } else {
                mergedLines.push(targetLines[i]);
            }
        } else if (i < sourceLines.length) {
            mergedLines.push(sourceLines[i]);
        } else {
            mergedLines.push(targetLines[i]);
        }
    }

    return mergedLines.join('\n');
}
