# A State Machine

New name needed.

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

`PL PM PX EV OP TG VL`

 + PreconditionLocation (PL)
 + PreconditionMinBound inclusive (PM)
 + PreconditionMaxBound inclusive (PX)
 + Event (EV)
 + Operation (OP)
 + Target (TG)
 + Value (VL)

Mental model: When PL is between PM and PX, and EV happens (to PL), do OP on TG with VL

### Precondition

The global state 0x10 starts as 00, so init instructions of the program would ordinarily all begin with `10 00 00`: "The Global State == 0"

### Events

| Byte | Assembly | Description
| ---- | -------- | -----------
| 00 | IM | Immediately 
| 1x | AT | After x ticks
| 21 | LC | On left click
| 22 | RC | On right click
| 23 | MC | On middle click
| 2F | CL | On any click
| 3x | KD | On x keydown (see Key IDs)
| 4x | KU | On x keyup (see Key IDs)
| 5x |    | RFU
| 61 | ME | On mouse enter
| 62 | ML | On mouse leave
| 63 | MM | On mouse mouse? RFU

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

### Operations

| 00  | Set to Literal
| 01  | Set to Variable
| 02  | Add Literal
| 03  | Add Var
| 04  | Subtract Literal
| 05  | Subtract Var
| 06+ | RFU

## Example Program

Comments can be written after `;`

```
;PL PM PX EV OP TG VL
 10 00 00 00 00 05 CC ; Init (global 0 is 0) immediately set Grid 5 to CC (204)
 10 00 00 00 02 10 01 ; End init by adding 1 to global state
 05 00 02 21 02 05 01 ; When grid 5 is between 0 and 2 and left clicked increment it
 05 01 03 21 04 05 01 ; When grid 5 is between 1 and 3 and right clicked decrement it
 00 00 00 21 01 E0 05 ; When grid 0 is clicked, set the display mode to the value of grid 5
```


## Implementation

### Event Resolution

Priority:

+ All the Immediate effects whose preconditions are met. 
+ All the tick effects whose preconditions are met, as above.
+ Mouse events
+ Keyboard events

Tie-breaker is "as-instructed" order, so the immediates nearer the start of the program happen before those written after, for example.
