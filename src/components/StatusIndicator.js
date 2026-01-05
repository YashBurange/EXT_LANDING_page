/**
 * StatusIndicator Component
 * Manages the status indicator in the editor title bar
 * Shows current file lock state and active collaborators
 */
export class StatusIndicator {
    constructor(element, options = {}) {
        this.element = element;
        this.status = options.status || 'active';
        this.lockState = options.lockState || 'unlocked';
        this.activeCollaborators = options.activeCollaborators || [];
        this.update();
    }
    
    setStatus(status) {
        this.status = status;
        this.update();
    }
    
    setLockState(lockState) {
        this.lockState = lockState;
        this.update();
    }
    
    setActiveCollaborators(collaborators) {
        this.activeCollaborators = collaborators;
        this.update();
    }
    
    addCollaborator(userName) {
        if (!this.activeCollaborators.includes(userName)) {
            this.activeCollaborators.push(userName);
            this.update();
        }
    }
    
    removeCollaborator(userName) {
        const index = this.activeCollaborators.indexOf(userName);
        if (index > -1) {
            this.activeCollaborators.splice(index, 1);
            this.update();
        }
    }
    
    update() {
        const statusIcon = this.status === 'active' ? '●' : '○';
        let statusText = `${statusIcon} ${this.status === 'active' ? 'Active' : 'Inactive'}`;
        
        // Add lock state
        if (this.lockState === 'locked') {
            statusText += ' 🔒';
        } else if (this.lockState === 'partial') {
            statusText += ' ⚠';
        }
        
        // Add active collaborators count (compact format)
        if (this.activeCollaborators.length > 0) {
            statusText += ` 👥${this.activeCollaborators.length}`;
        }
        
        this.element.textContent = statusText;
        this.element.title = this.buildTooltip();
    }
    
    buildTooltip() {
        let tooltip = `Status: ${this.status}\nLock State: ${this.lockState}`;
        if (this.activeCollaborators.length > 0) {
            tooltip += `\nActive Collaborators: ${this.activeCollaborators.join(', ')}`;
        }
        return tooltip;
    }
}

