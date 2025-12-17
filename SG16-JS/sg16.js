// SG16 State Machine VM Implementation

class SG16VM {
    constructor() {
        this.memory = new Uint8Array(256); // 0x00 to 0xFF
        this.program = [];
        this.tickCounter = 0;
        this.tickTimer = null;
        this.frameTimer = null;
        this.tickEvents = []; // Track pending tick events
        this.running = false;
        this.focused = false;
    }

    reset() {
        this.memory.fill(0);
        this.program = [];
        this.tickCounter = 0;
        this.tickEvents = [];
        this.stopTimers();
        this.running = false;
    }

    focus() {
        this.focused = true;
        document.getElementById('gridContainer').classList.add('focused');
    }

    unfocus() {
        this.focused = false;
        document.getElementById('gridContainer').classList.remove('focused');
    }

    loadProgram(programText) {
        this.reset();
        
        // Compile the program first (handles both assembly and bytecode)
        const bytecode = compile(programText);
        
        for (const bytes of bytecode) {
            this.program.push({
                pl: bytes[0],
                pm: bytes[1],
                px: bytes[2],
                ev: bytes[3],
                op: bytes[4],
                tg: bytes[5],
                vl: bytes[6]
            });
        }
    }

    start() {
        this.running = true;
        
        // Execute all immediate instructions once at startup
        this.executeImmediate();
        
        // Start tick timer (62.5ms = 1/16th second)
        this.tickTimer = setInterval(() => {
            this.tickCounter++;
            this.processTicks();
        }, 62.5);

        // Start update/render timer (60fps)
        // Executes immediate instructions every frame and renders
        this.frameTimer = setInterval(() => {
            this.executeImmediate();
            this.render();
        }, 16.67);
    }

    stopTimers() {
        if (this.tickTimer) {
            clearInterval(this.tickTimer);
            this.tickTimer = null;
        }
        if (this.frameTimer) {
            clearInterval(this.frameTimer);
            this.frameTimer = null;
        }
    }

    checkPrecondition(instruction) {
        const value = this.memory[instruction.pl];
        return value >= instruction.pm && value <= instruction.px;
    }

    executeOperation(instruction) {
        const op = instruction.op;
        const tg = instruction.tg;
        const vl = instruction.vl;
        
        let result;
        
        switch (op) {
            case 0x00: // SEL - Set to Literal
                result = vl;
                break;
            case 0x01: // SEV - Set to Variable
                result = this.memory[vl];
                break;
            case 0x02: // ADL - Add Literal
                result = this.memory[tg] + vl;
                break;
            case 0x03: // ADV - Add Variable
                result = this.memory[tg] + this.memory[vl];
                break;
            case 0x04: // SUL - Subtract Literal
                result = this.memory[tg] - vl;
                break;
            case 0x05: // SUV - Subtract Variable
                result = this.memory[tg] - this.memory[vl];
                break;
            default:
                return; // Unknown operation
        }
        
        // Cap at 0x00 and 0xFF
        result = Math.max(0, Math.min(255, result));
        console.log(`Executing OP ${op.toString(16).toUpperCase()} on TG ${tg.toString(16).toUpperCase()} with VL ${vl.toString(16).toUpperCase()}: Result = ${result.toString(16).toUpperCase()}`);
        this.memory[tg] = result;
    }

    executeImmediate() {
        for (const instruction of this.program) {
            if (instruction.ev === 0x00) { // IMM
                console.log(`Executing immediate instruction at PL ${instruction.pl.toString(16).toUpperCase()}`);
                if (this.checkPrecondition(instruction)) {
                    this.executeOperation(instruction);
                }
            }
        }
    }

    processTicks() {
        // Execute all tick-based instructions
        for (const instruction of this.program) {
            if ((instruction.ev & 0xF0) === 0x10) { // AxT events
                const ticksNeeded = instruction.ev & 0x0F;
                
                // Check if this is a new tick event that should fire
                const eventKey = `${instruction.pl}-${instruction.pm}-${instruction.px}-${instruction.ev}`;
                
                if (!this.tickEvents.includes(eventKey)) {
                    if (this.checkPrecondition(instruction)) {
                        // Schedule this event to fire after ticksNeeded ticks
                        setTimeout(() => {
                            if (this.running && this.checkPrecondition(instruction)) {
                                this.executeOperation(instruction);
                                // Remove from pending after firing (one-off event)
                                const idx = this.tickEvents.indexOf(eventKey);
                                if (idx !== -1) {
                                    this.tickEvents.splice(idx, 1);
                                }
                            }
                        }, ticksNeeded * 62.5);
                        
                        this.tickEvents.push(eventKey);
                    }
                }
            }
        }
    }

    handleMouseEvent(cellIndex, eventType) {
        // eventType: 0x21 (left), 0x22 (right), 0x23 (middle), 0x2F (any)
        
        // Set click device
        if (eventType === 0x21) this.memory[0xE2] = 1;
        else if (eventType === 0x22) this.memory[0xE2] = 2;
        else if (eventType === 0x23) this.memory[0xE2] = 3;
        
        // Only execute the first matching instruction per click event
        for (const instruction of this.program) {
            // Check if event matches
            const eventMatches = instruction.ev === eventType || 
                               (instruction.ev === 0x2F && (eventType >= 0x21 && eventType <= 0x23));
            
            if (!eventMatches) continue;
            
            // Check if PL is this cell or "anywhere" (not in grid range)
            const plMatchesCell = instruction.pl === cellIndex;
            const plIsAnywhere = instruction.pl > 0x0F;
            
            console.log(`Mouse ${eventType} on cell ${cellIndex}, match? ${plMatchesCell || plIsAnywhere}`);

            if (plMatchesCell || plIsAnywhere) {
                if (this.checkPrecondition(instruction)) {
                    this.executeOperation(instruction);
                    // Only execute first matching instruction per event
                    break;
                }
            }
        }
        
        this.render();
    }

    handleKeyEvent(keyCode, isKeyDown) {
        // Set keyboard device
        this.memory[0xE3] = keyCode;
        
        const eventType = isKeyDown ? 0x30 : 0x40; // KDx or KUx base
        
        // Only execute the first matching instruction per key event
        for (const instruction of this.program) {
            // Check if this is a key event
            const isKeyDownEvent = (instruction.ev & 0xF0) === 0x30;
            const isKeyUpEvent = (instruction.ev & 0xF0) === 0x40;
            
            if (!isKeyDownEvent && !isKeyUpEvent) continue;
            
            // Check if key matches
            const instructionKey = instruction.ev & 0x0F;
            const eventMatches = (isKeyDown && isKeyDownEvent) || (!isKeyDown && isKeyUpEvent);
            const keyMatches = instructionKey === keyCode || instructionKey === 0x0F; // 0xF = any key
            
            if (eventMatches && keyMatches) {
                if (this.checkPrecondition(instruction)) {
                    this.executeOperation(instruction);
                    // Only execute first matching instruction per event
                    break;
                }
            }
        }
        
        this.render();
    }

    render() {
        // Update grid cells
        for (let i = 0; i < 16; i++) {
            const cell = document.getElementById(`cell-${i}`);
            if (!cell) continue;
            
            const value = this.memory[i];
            const displayMode = this.memory[0xE0];
            
            this.renderCell(cell, value, displayMode);
        }
        
        // Update variable display
        for (let i = 0x10; i <= 0x1F; i++) {
            const elem = document.getElementById(`var-${i.toString(16).toUpperCase()}`);
            if (elem) {
                elem.textContent = this.memory[i].toString(16).toUpperCase().padStart(2, '0');
            }
        }
        
        // Update device memory
        document.getElementById('var-E0').textContent = 
            this.memory[0xE0].toString(16).toUpperCase().padStart(2, '0');
        document.getElementById('var-E2').textContent = 
            this.memory[0xE2].toString(16).toUpperCase().padStart(2, '0');
        document.getElementById('var-E3').textContent = 
            this.memory[0xE3].toString(16).toUpperCase().padStart(2, '0');
    }

    renderCell(cell, value, displayMode) {
        switch (displayMode) {
            case 0x00: // Hex literal
                cell.textContent = value.toString(16).toUpperCase().padStart(2, '0');
                cell.style.background = 'white';
                cell.style.color = 'black';
                break;
                
            case 0x01: // RGB - RRRGGGBB
                const r = ((value >> 5) & 0x07) * 36; // 3 bits -> 0-252
                const g = ((value >> 2) & 0x07) * 36; // 3 bits -> 0-252
                const b = (value & 0x03) * 85;        // 2 bits -> 0-255
                cell.style.background = `rgb(${r}, ${g}, ${b})`;
                cell.textContent = '';
                break;
                
            case 0x02: // ASCII
                if (value >= 32 && value <= 126) {
                    cell.textContent = String.fromCharCode(value);
                } else {
                    cell.textContent = '';
                }
                cell.style.background = 'white';
                cell.style.color = 'black';
                break;
                
            case 0x03: // Icons (placeholder)
                cell.textContent = '◆';
                cell.style.background = 'white';
                cell.style.color = 'black';
                break;
                
            default:
                cell.textContent = '?';
                cell.style.background = 'white';
                cell.style.color = 'red';
        }
    }
}

// Initialize the VM and UI
const vm = new SG16VM();

function initUI() {
    // Create grid cells
    const grid = document.getElementById('grid');
    for (let i = 0; i < 16; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.id = `cell-${i}`;
        cell.textContent = '00';
        
        // Add mouse event listeners
        cell.addEventListener('click', (e) => {
            e.preventDefault();
            vm.handleMouseEvent(i, 0x21); // Left click
        });
        
        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            vm.handleMouseEvent(i, 0x22); // Right click
        });
        
        cell.addEventListener('auxclick', (e) => {
            e.preventDefault();
            if (e.button === 1) {
                vm.handleMouseEvent(i, 0x23); // Middle click
            }
        });
        
        grid.appendChild(cell);
    }
    
    // Create variable table
    const varTable = document.getElementById('variables');
    for (let i = 0x10; i <= 0x1F; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>0x${i.toString(16).toUpperCase()}</td>
            <td id="var-${i.toString(16).toUpperCase()}">00</td>
        `;
        varTable.appendChild(row);
    }
    
    // Add keyboard listener (only when VM is focused)
    document.addEventListener('keydown', (e) => {
        if (!vm.focused) return;
        const keyCode = mapKeyToCode(e.key);
        if (keyCode !== null) {
            e.preventDefault();
            vm.handleKeyEvent(keyCode, true);
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (!vm.focused) return;
        const keyCode = mapKeyToCode(e.key);
        if (keyCode !== null) {
            e.preventDefault();
            vm.handleKeyEvent(keyCode, false);
        }
    });
    
    // Focus VM when clicking on grid
    grid.addEventListener('click', () => {
        vm.focus();
    });
    
    // Unfocus VM when clicking on sidebar or program area
    document.querySelector('.sidebar').addEventListener('click', () => {
        vm.unfocus();
    });
    
    document.getElementById('program').addEventListener('focus', () => {
        vm.unfocus();
    });
    
    // Button handlers
    document.getElementById('loadBtn').addEventListener('click', () => {
        try {
            const programText = document.getElementById('program').value;
            vm.loadProgram(programText);
            vm.start();
            document.getElementById('status').textContent = 
                `Loaded ${vm.program.length} instructions. Running...`;
            document.getElementById('status').className = 'status';
        } catch (e) {
            document.getElementById('status').textContent = `Error: ${e.message}`;
            document.getElementById('status').className = 'status error';
        }
    });
    
    document.getElementById('resetBtn').addEventListener('click', () => {
        vm.reset();
        vm.render();
        document.getElementById('status').textContent = 'Reset complete.';
        document.getElementById('status').className = 'status';
    });
    
    // Initial render
    vm.render();
}

function mapKeyToCode(key) {
    // Map keyboard keys to SG16 key codes
    if (key >= '0' && key <= '9') {
        return parseInt(key, 10);
    }
    
    switch (key.toLowerCase()) {
        case 'arrowup':
        case 'w':
            return 0x0A; // A
        case 'arrowdown':
        case 's':
            return 0x0B; // B
        case 'arrowleft':
        case 'a':
            return 0x0C; // C
        case 'arrowright':
        case 'd':
            return 0x0D; // D
        case 'enter':
            return 0x0E; // E
        default:
            return 0x0F; // Any other key maps to F (any key)
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
} else {
    initUI();
}
