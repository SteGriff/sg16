// SG16 Assembly Compiler
// Compiles assembly mnemonics to bytecode

const EVENT_MNEMONICS = {
    'IMM': 0x00,
    
    // Tick events A1T to AFT
    'A1T': 0x11, 'A2T': 0x12, 'A3T': 0x13, 'A4T': 0x14,
    'A5T': 0x15, 'A6T': 0x16, 'A7T': 0x17, 'A8T': 0x18,
    'A9T': 0x19, 'AAT': 0x1A, 'ABT': 0x1B, 'ACT': 0x1C,
    'ADT': 0x1D, 'AET': 0x1E, 'AFT': 0x1F,
    
    // Mouse events
    'OLC': 0x21,
    'ORC': 0x22,
    'OMC': 0x23,
    'OAC': 0x2F,
    
    // Key down events KD0 to KDF
    'KD0': 0x30, 'KD1': 0x31, 'KD2': 0x32, 'KD3': 0x33,
    'KD4': 0x34, 'KD5': 0x35, 'KD6': 0x36, 'KD7': 0x37,
    'KD8': 0x38, 'KD9': 0x39, 'KDA': 0x3A, 'KDB': 0x3B,
    'KDC': 0x3C, 'KDD': 0x3D, 'KDE': 0x3E, 'KDF': 0x3F,
    
    // Key up events KU0 to KUF
    'KU0': 0x40, 'KU1': 0x41, 'KU2': 0x42, 'KU3': 0x43,
    'KU4': 0x44, 'KU5': 0x45, 'KU6': 0x46, 'KU7': 0x47,
    'KU8': 0x48, 'KU9': 0x49, 'KUA': 0x4A, 'KUB': 0x4B,
    'KUC': 0x4C, 'KUD': 0x4D, 'KUE': 0x4E, 'KUF': 0x4F,
    
    // Mouse enter/leave
    'OME': 0x61,
    'OML': 0x62,
    'OMM': 0x63
};

const OPERATION_MNEMONICS = {
    'SEL': 0x00,
    'SEV': 0x01,
    'ADL': 0x02,
    'ADV': 0x03,
    'SUL': 0x04,
    'SUV': 0x05
};

function isHexByte(str) {
    return /^[0-9A-Fa-f]{1,2}$/.test(str);
}

function parseHexByte(str) {
    const value = parseInt(str, 16);
    if (isNaN(value) || value < 0 || value > 255) {
        throw new Error(`Invalid hex byte: ${str}`);
    }
    return value;
}

function compileLine(line) {
    // Remove comments
    line = line.split(';')[0].trim();
    
    if (line.length === 0) {
        return null;
    }
    
    const tokens = line.split(/\s+/).filter(t => t.length > 0);
    
    // Check if this is already bytecode (all hex values)
    if (tokens.every(isHexByte)) {
        if (tokens.length !== 7) {
            throw new Error(`Invalid instruction length: expected 7 bytes, got ${tokens.length}`);
        }
        return tokens.map(parseHexByte);
    }
    
    // Otherwise, compile assembly
    if (tokens.length !== 7) {
        throw new Error(`Invalid instruction format: expected 7 tokens, got ${tokens.length} in "${line}"`);
    }
    
    const [plStr, pmStr, pxStr, evStr, opStr, tgStr, vlStr] = tokens;
    
    // Parse PL, PM, PX (always hex)
    const pl = parseHexByte(plStr);
    const pm = parseHexByte(pmStr);
    const px = parseHexByte(pxStr);
    
    // Parse Event (can be hex or mnemonic)
    let ev;
    if (isHexByte(evStr)) {
        ev = parseHexByte(evStr);
    } else {
        const evUpper = evStr.toUpperCase();
        if (!(evUpper in EVENT_MNEMONICS)) {
            throw new Error(`Unknown event mnemonic: ${evStr}`);
        }
        ev = EVENT_MNEMONICS[evUpper];
    }
    
    // Parse Operation (can be hex or mnemonic)
    let op;
    if (isHexByte(opStr)) {
        op = parseHexByte(opStr);
    } else {
        const opUpper = opStr.toUpperCase();
        if (!(opUpper in OPERATION_MNEMONICS)) {
            throw new Error(`Unknown operation mnemonic: ${opStr}`);
        }
        op = OPERATION_MNEMONICS[opUpper];
    }
    
    // Parse TG, VL (always hex)
    const tg = parseHexByte(tgStr);
    const vl = parseHexByte(vlStr);
    
    return [pl, pm, px, ev, op, tg, vl];
}

function compile(programText) {
    const lines = programText.split('\n');
    const bytecode = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        try {
            const compiled = compileLine(line);
            if (compiled !== null) {
                bytecode.push(compiled);
            }
        } catch (e) {
            errors.push(`Line ${index + 1}: ${e.message}`);
        }
    });
    
    if (errors.length > 0) {
        throw new Error(errors.join('\n'));
    }
    
    return bytecode;
}

function bytecodeToString(bytecode) {
    return bytecode.map(instruction => 
        instruction.map(byte => 
            byte.toString(16).toUpperCase().padStart(2, '0')
        ).join(' ')
    ).join('\n');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { compile, bytecodeToString };
}
