document.addEventListener('DOMContentLoaded', () => {
    initSpotlight();
    initScrollAnimations();
    initRealTimeCollaboration();
});

/* -------------------------------------------------------------------------- */
/*                               Spotlight Effect                             */
/* -------------------------------------------------------------------------- */
function initSpotlight() {
    const cards = document.querySelectorAll('[data-spotlight]');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

/* -------------------------------------------------------------------------- */
/*                             Scroll Animations                              */
/* -------------------------------------------------------------------------- */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in-up').forEach(el => {
        observer.observe(el);
    });
}

/* -------------------------------------------------------------------------- */
/*                      Real-time Collaboration Demo                          */
/* -------------------------------------------------------------------------- */
function initRealTimeCollaboration() {
    const editorA = document.getElementById('editor-a');
    const editorB = document.getElementById('editor-b');
    const markerLayerA = document.getElementById('marker-layer-a');
    const markerLayerB = document.getElementById('marker-layer-b');
    const lineNumbersA = document.getElementById('line-numbers-a');
    const lineNumbersB = document.getElementById('line-numbers-b');

    // Track active lines for each user
    let activeLineA = null;
    let activeLineB = null;

    // Initialize line numbers
    updateLineNumbers(editorA, lineNumbersA);
    updateLineNumbers(editorB, lineNumbersB);

    // Setup editor A
    setupEditor(editorA, markerLayerB, lineNumbersA, 'User A', (line) => {
        activeLineA = line;
        showMarker(markerLayerB, line, 'User A', 'user-a');
    }, () => {
        activeLineA = null;
        clearMarker(markerLayerB, 'user-a');
    });

    // Setup editor B
    setupEditor(editorB, markerLayerA, lineNumbersB, 'User B', (line) => {
        activeLineB = line;
        showMarker(markerLayerA, line, 'User B', 'user-b');
    }, () => {
        activeLineB = null;
        clearMarker(markerLayerA, 'user-b');
    });

    // Simulate User B typing (for demo purposes)
    simulateUserBActivity(editorB, markerLayerA, lineNumbersB);
}

function setupEditor(editor, targetMarkerLayer, lineNumbers, userName, onLineChange, onBlur) {
    // Update line numbers on content change
    editor.addEventListener('input', () => {
        updateLineNumbers(editor, lineNumbers);
        const line = getCurrentLine(editor);
        if (line !== null) {
            onLineChange(line);
        }
    });

    // Track cursor position
    editor.addEventListener('keyup', () => {
        const line = getCurrentLine(editor);
        if (line !== null) {
            onLineChange(line);
        }
    });

    editor.addEventListener('click', () => {
        const line = getCurrentLine(editor);
        if (line !== null) {
            onLineChange(line);
        }
    });

    editor.addEventListener('blur', () => {
        // Keep marker visible for a bit after blur
        setTimeout(() => {
            onBlur();
        }, 2000);
    });

    // Preserve indentation on Enter
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const textNode = range.startContainer;
            
            // Get current line indentation
            const lineText = getLineText(editor, getCurrentLine(editor));
            const indentMatch = lineText.match(/^(\s*)/);
            const indent = indentMatch ? indentMatch[1] : '';
            
            // Insert newline with indentation
            const newline = document.createTextNode('\n' + indent);
            range.insertNode(newline);
            
            // Move cursor after indentation
            range.setStartAfter(newline);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            updateLineNumbers(editor, lineNumbers);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const textNode = document.createTextNode('    '); // 4 spaces
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    });
}

function getCurrentLine(editor) {
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

function getLineText(editor, lineNum) {
    const text = editor.textContent || editor.innerText;
    const lines = text.split('\n');
    return lines[lineNum - 1] || '';
}

function updateLineNumbers(editor, lineNumbersContainer) {
    const text = editor.textContent || editor.innerText;
    const lineCount = Math.max(text.split('\n').length, 1);
    
    // Update line numbers
    lineNumbersContainer.innerHTML = '';
    for (let i = 1; i <= lineCount; i++) {
        const span = document.createElement('span');
        span.textContent = i;
        lineNumbersContainer.appendChild(span);
    }
}

function showMarker(markerLayer, lineNumber, userName, userClass) {
    // Clear existing marker for this user
    clearMarker(markerLayer, userClass);
    
    if (lineNumber === null || lineNumber < 1) return;
    
    const marker = document.createElement('div');
    marker.className = `marker ${userClass}`;
    marker.dataset.label = `${userName} editing`;
    marker.dataset.line = lineNumber;
    
    // Get the editor element to calculate line height
    const editor = markerLayer.parentElement.querySelector('.code-editor');
    if (!editor) return;
    
    // Calculate position based on actual line height
    // Line height is 1.5 * font-size (0.9rem = 14.4px), so 1.5 * 14.4 = 21.6px per line
    const fontSize = parseFloat(getComputedStyle(editor).fontSize);
    const lineHeight = fontSize * 1.5; // 1.5em line-height
    const padding = 10; // Top padding of editor
    const topPosition = (lineNumber - 1) * lineHeight + padding;
    
    marker.style.top = `${topPosition}px`;
    markerLayer.appendChild(marker);
}

function clearMarker(markerLayer, userClass) {
    const existingMarker = markerLayer.querySelector(`.marker.${userClass}`);
    if (existingMarker) {
        existingMarker.remove();
    }
}

function simulateUserBActivity(editor, markerLayer, lineNumbers) {
    // Simulate User B editing different lines periodically
    let currentSimLine = 3;
    let isIncreasing = true;
    
    setInterval(() => {
        if (document.activeElement !== editor) {
            showMarker(markerLayer, currentSimLine, 'User B', 'user-b');
            
            if (isIncreasing) {
                currentSimLine++;
                if (currentSimLine > 8) {
                    isIncreasing = false;
                }
            } else {
                currentSimLine--;
                if (currentSimLine < 2) {
                    isIncreasing = true;
                }
            }
        }
    }, 3000);
}
