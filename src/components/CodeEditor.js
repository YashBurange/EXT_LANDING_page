import { getCurrentLine, getLineText } from '../utils/lineTracking.js';
import { debounce } from '../utils/domUtils.js';

/**
 * CodeEditor Component
 * Manages a contenteditable code editor with line tracking and indentation
 */
export class CodeEditor {
    constructor(editorElement, lineNumbersElement, options = {}) {
        this.editor = editorElement;
        this.lineNumbers = lineNumbersElement;
        this.onLineChange = options.onLineChange || (() => {});
        this.onBlur = options.onBlur || (() => {});
        this.onContentChange = options.onContentChange || (() => {});
        this.onLineAdded = options.onLineAdded || (() => {});
        this.onLineEdited = options.onLineEdited || (() => {});
        
        this.activeLine = null;
        this.blurTimeout = null;
        this.previousContent = this.getContent();
        this.previousLineCount = this.getLineCount();
        
        this.init();
    }
    
    init() {
        this.updateLineNumbers();
        this.attachEventListeners();
    }
    
    attachEventListeners() {
        // Update line numbers on content change
        this.editor.addEventListener('input', () => {
            console.log('Editor input event fired');
            this.handleContentChange();
            this.updateLineNumbers();
            this.handleLineChange();
            this.onContentChange();
        });
        
        // Track cursor position
        this.editor.addEventListener('keyup', () => {
            this.handleLineChange();
        });
        
        this.editor.addEventListener('click', () => {
            this.handleLineChange();
        });
        
        this.editor.addEventListener('blur', () => {
            // Keep marker visible for a bit after blur
            if (this.blurTimeout) {
                clearTimeout(this.blurTimeout);
            }
            this.blurTimeout = setTimeout(() => {
                this.activeLine = null;
                this.onBlur();
            }, 2000);
        });
        
        // Handle special keys
        this.editor.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });
    }
    
    handleLineChange() {
        const line = getCurrentLine(this.editor);
        if (line !== null && line !== this.activeLine) {
            this.activeLine = line;
            this.onLineChange(line);
        }
    }
    
    handleKeyDown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.handleEnterKey();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.handleTabKey();
        }
    }
    
    handleEnterKey() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const currentLine = getCurrentLine(this.editor);
        const lineText = getLineText(this.editor, currentLine);
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
        
        // Update line numbers immediately
        this.updateLineNumbers();
        
        // Trigger input event to ensure all handlers fire
        const inputEvent = new Event('input', { bubbles: true });
        this.editor.dispatchEvent(inputEvent);
    }
    
    handleTabKey() {
        const selection = window.getSelection();
        if (selection.rangeCount === 0) return;
        
        const range = selection.getRangeAt(0);
        const tab = document.createTextNode('    '); // 4 spaces
        range.insertNode(tab);
        range.setStartAfter(tab);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    updateLineNumbers() {
        const text = this.editor.textContent || this.editor.innerText;
        // Split by newline - this includes empty lines
        const lines = text.split('\n');
        const lineCount = Math.max(lines.length, 1);
        
        // Update line numbers - ensure all lines are numbered including empty ones
        this.lineNumbers.innerHTML = '';
        for (let i = 1; i <= lineCount; i++) {
            const span = document.createElement('span');
            span.textContent = i;
            span.style.display = 'block';
            span.style.minHeight = '1.5em';
            span.style.height = '1.5em';
            // Ensure empty lines still have a span (even if empty, they should be numbered)
            this.lineNumbers.appendChild(span);
        }
        
        // Sync scrolling between editor and line numbers
        this.syncScrolling();
    }
    
    syncScrolling() {
        // Also sync in reverse when line numbers are scrolled
        if (!this.lineNumbersScrollListener) {
            this.lineNumbersScrollListener = () => {
                this.editor.scrollTop = this.lineNumbers.scrollTop;
            };
            this.lineNumbers.addEventListener('scroll', this.lineNumbersScrollListener);
        }
        
        if (!this.editorScrollListener) {
            this.editorScrollListener = () => {
                this.lineNumbers.scrollTop = this.editor.scrollTop;
            };
            this.editor.addEventListener('scroll', this.editorScrollListener);
        }
        
        // Initial sync
        this.lineNumbers.scrollTop = this.editor.scrollTop;
    }
    
    getContent() {
        return this.editor.textContent || this.editor.innerText;
    }
    
    setContent(content) {
        // Preserve whitespace by using textContent
        this.editor.textContent = content;
        // Force reflow to ensure proper rendering
        this.editor.style.whiteSpace = 'pre';
        this.updateLineNumbers();
    }
    
    getActiveLine() {
        return this.activeLine;
    }
    
    getLineCount() {
        const text = this.editor.textContent || this.editor.innerText;
        // Count all lines including empty ones
        const lines = text.split('\n');
        return Math.max(lines.length, 1);
    }
    
    handleContentChange() {
        const currentContent = this.getContent();
        const currentLineCount = this.getLineCount();
        const previousLineCount = this.previousLineCount;
        const currentLine = this.getActiveLine();
        
        if (currentLine === null) {
            this.previousContent = currentContent;
            this.previousLineCount = currentLineCount;
            return;
        }
        
        const previousLines = this.previousContent.split('\n');
        const currentLines = currentContent.split('\n');
        
        // Detect if a new line was added
        if (currentLineCount > previousLineCount) {
            // Check if current line is new (beyond previous line count)
            if (currentLine > previousLineCount) {
                console.log('Line added detected:', currentLine, 'Previous count:', previousLineCount);
                this.onLineAdded(currentLine);
            } else {
                // Line count increased but we're on an existing line - might be edit
                if (currentLine <= previousLines.length && 
                    previousLines[currentLine - 1] !== currentLines[currentLine - 1]) {
                    console.log('Line edited detected:', currentLine);
                    this.onLineEdited(currentLine);
                }
            }
        } else if (currentLineCount === previousLineCount && currentLine <= previousLines.length) {
            // Existing line was edited (content changed but line count same)
            if (previousLines[currentLine - 1] !== currentLines[currentLine - 1]) {
                console.log('Line edited detected:', currentLine);
                this.onLineEdited(currentLine);
            }
        }
        
        this.previousContent = currentContent;
        this.previousLineCount = currentLineCount;
    }
    
    getChanges() {
        // Return a snapshot of current content for git operations
        return {
            content: this.getContent(),
            lineCount: this.getLineCount()
        };
    }
}

