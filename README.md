# SG16 State Machine

This is a whimsical primitive state machine based computing environment for writing 8 bit programs. This takes inspiration from uxn/varvara and other small computing experiments.

## Memory

The memory is structured from 0x00 to 0xFF like so:

0x0X - Grid-displayed memory
0x1X - Non-displayed memory
0xE0 - Display mode

Other prefixed areas of memory are RFU.

All memory is initialised with value 00.

### 0x0X - Grid

Imagine a 4x4 grid which is displayed on-screen but is also raw memory.

The cell addresses are 0x0...

| | | | |
|-|-|-|-|
| 0 | 1 | 2 | 3 |
| 4 | 5 | 6 | 7 |
| 8 | 9 | A | B |
| C | D | E | F |

So 0x00 is the address of the top left, and 0x0F is the address of the bottom right.

The grid is the central UI element and takes up most of the screen in a UI implementation. Its display mode varies - see Display Mode.

### 0x1X - Global variables

0x10 is the global state and is special. See programs/preconditions.

0x11 - 0x1F can be used as general variables.

### 0xE0 Display Mode

The display mode byte can be set to one of the following:

| Byte | Description
| ---- | -----------
| 0x00 | Hex literal display - show "00", "02", "AA", etc in the grid cell
| 0x01 | RGB - 8 bit colour using bits RRRGGGBB
| 0x02 | ASCII - corresponding ASCII character for the value 0-255. Only show displayable values
| 0x03 | Icons - display one of the custom 255 icons from a library (TBC)

## Programs

### Instruction format

Every line is 7 bytes:

`PL PM PX EV OP TG VL`

 + PreconditionLocation (PL)
 + PreconditionMinBound inclusive (PM)
 + PreconditionMaxBound inclusive (PX)
 + Event (EV)
 + Operation (OP)
 + Target (TG) - memory address 0x00 to 0xFF to target
 + Value (VL) - literal or variable address depending on OP

Mental model: When PL is between PM and PX, and EV happens (to PL), do OP on TG with VL.

Currently, PM and PX are constrained to constant (literal) values rather than checking a variable.

The PL does double duty as the gate to check for preconditions but also as the UI element in scope. To check for click (any mouse button) on grid square `00` use `00 00 FF 2F ...`

### Precondition

The global state 0x10 starts as 00, so init instructions of the program would ordinarily all begin with `10 00 00`: "The Global State == 0"

### Events

| Byte | Assembly | Description
| ---- | -------- | -----------
| 00 | IMM | Immediately 
| 1x | AxT | After x ticks (one off event)
| 21 | OLC | On left click
| 22 | ORC | On right click
| 23 | OMC | On middle click
| 2F | OAC | On any click
| 3x | KDx | On x keydown (see Key IDs)
| 4x | KUx | On x keyup (see Key IDs)
| 5x |     | RFU
| 61 | OME | On mouse enter
| 62 | OML | On mouse leave
| 63 | OMM | On mouse mouse? RFU

#### Ticks

I suppose it would make sense to divide a second into 16 parts? So event 11 is after 1/16th of a second, and event 1F is after a whole second. 

Multiple seconds could be tracked by incrementing another counter after F ticks then checking the value of that as a precondition to the state machine, etc...

#### Key IDs

Only a subset of keyboard keys will be registered:

| Bit     | Description
| ------- | -----------
| 0-9     | the literal number keys, whether from the number row or the numpad.
| A,B,C,D | UP or W, DOWN or S, LEFT or A, RIGHT or D
| E       | Enter/Return key
| F       | Any key

Assembly: `KD0` is key 0 down, `KUE` is enter key up, etc.

### Operations

| Byte | Assembly | Description
| ---- | -------- | -----------
| 00   | SEL | Set TG to Literal VL
| 01   | SEV | Set TG to the value of variable at VL
| 02   | ADL | Add literal VL to TG
| 03   | ADV | Add value of variable at VL to TG
| 04   | SUL | Subtract Literal
| 05   | SUV | Subtract Variable
| 06+  |     | RFU

## Example Programs

### Display modes

Comments can be written after `;`

```
;PL PM PX EV OP TG VL
 10 00 00 00 00 05 01 ; Init (global 0 is 0) immediately set Grid 5 to 01
 10 00 00 00 00 03 E0 ; Init - set right column grid value decoratively
 10 00 00 00 00 07 FC ; 
 10 00 00 00 00 0B 1C ; 
 10 00 00 00 00 0F 03 ; 
 10 00 00 00 02 10 01 ; End init by adding 1 to global state
 05 00 02 21 02 05 01 ; When grid 5 is 0 to 2, and left clicked increment it
 05 01 03 22 04 05 01 ; When grid 5 is 1 to 3, and right clicked decrement it
 00 00 00 21 01 E0 05 ; When grid 0 is clicked, set the display mode to the value of grid 5
```

Can also be written in assembly:

```
10 00 00 IMM SEL 05 01
...
10 00 00 IMM SEL 10 01
05 00 02 OLC ADL 05 01
05 01 03 ORC SUL 05 01
00 00 00 OLC SEV E0 05
```

### Timer

```
00 00 00 OLC SEL 00 01 ; Click to toggle grid 0 
00 01 01 OLC SEL 00 00 ; toggle
00 01 01 AFT ADL 01 01 ; when on, after F ticks (1 second), add 1 to grid 1
```

## Implementations

### Event Resolution

Priority:

+ All the Immediate effects whose preconditions are met, in the order they were instructed.
+ All the tick effects whose preconditions are met, as above.
+ Mouse events
+ Keyboard events

Tie-breaker is "as-instructed" order, so the immediates nearer the start of the program happen before those written after, for example.

### Overflow/Underflow

Cap values at 00 and FF, don't wrap around or crash.
