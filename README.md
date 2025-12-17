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

### 0xE2 - the click device

Contains the last click type set by event 2x (1, 2, or 3), see Events

### 0xE3 - the keyboard device 

Contains the last key set by event 3x or 4x - see Events and Key IDs


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

The PreconditionLocation (PL) does double duty as the gate to check for preconditions but also as **the UI element in scope**. 

To check for click (any mouse button) on grid cell `00` regardless of its value, use `00 00 FF 2F ...`

If you only want the click event to fire if grid cell `00` is == 1, for example, use `00 01 01 2F...`

If you use a PL outside of 0x00 - 0x0F for a mouse event, then the location of the mouse event is considered to be "anywhere". 

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

When a keydown/up event happens, the key that was pressed is set into the keyboard device byte, 0xE3.

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
10 00 00 IMM ADL 10 01
05 00 02 OLC ADL 05 01
05 01 03 ORC SUL 05 01
00 00 00 OLC SEV E0 05
```

### Toggle

```
00 00 00 OLC SEL 00 01 ; Click to toggle grid 0 to 01 
00 01 01 OLC SEL 00 00 ; ... and back to 00
```

### Timer

```
; Let's call 03 the ticker, which can have BB (tick) or CC (tock)
10 00 00 IMM SEL 03 BB ; set ticker to tick
10 00 00 IMM SEL 10 01 ; finish init

03 BB BB AFT SEL 03 CC ; when ticker is tick, after 1 second, change to tock
03 CC CC AFT SEL 03 BB ; when ticker is tock, after 1 second, change to tick
03 BB BB IMM ADL 01 01 ; when ticker is tick, immediately add 1 to grid 1
03 CC CC IMM ADL 01 01 ; when ticker is tock, immediately add 1 to grid 1
01 FF FF IMM SEL 01 00 ; when timer reaches FF, set it to 00
```

### Typing

```
; Let 11 be the cursor position 0-F
; When a key 0-9 is struck, type the value of that key at the cursor position
10 00 00 IMM SEL 10 01 ; finish init

11 00 00 KDF SEV 00 E3 ; if cursor at 00, write key to grid 00
11 01 01 KDF SEV 01 E3 ; if cursor at 01, write key to grid 01
11 02 02 KDF SEV 02 E3 ; if cursor at 02, write key to grid 02
11 03 03 KDF SEV 03 E3 ; if cursor at 03, write key to grid 03
11 04 04 KDF SEV 04 E3 ; if cursor at 04, write key to grid 04
11 05 05 KDF SEV 05 E3 ; if cursor at 05, write key to grid 05
11 06 06 KDF SEV 06 E3 ; if cursor at 06, write key to grid 06
11 07 07 KDF SEV 07 E3 ; if cursor at 07, write key to grid 07
11 08 08 KDF SEV 08 E3 ; if cursor at 08, write key to grid 08
11 09 09 KDF SEV 09 E3 ; if cursor at 09, write key to grid 09
11 0A 0A KDF SEV 0A E3 ; if cursor at 0A, write key to grid 0A
11 0B 0B KDF SEV 0B E3 ; if cursor at 0B, write key to grid 0B
11 0C 0C KDF SEV 0C E3 ; if cursor at 0C, write key to grid 0C
11 0D 0D KDF SEV 0D E3 ; if cursor at 0D, write key to grid 0D
11 0E 0E KDF SEV 0E E3 ; if cursor at 0E, write key to grid 0E
11 0F 0F KDF SEV 0F E3 ; if cursor at 0F, write key to grid 0F
```

### Paint

```
; Set display mode to RGB
; Let 11 be paint colour, initialised as 03
; When enter key is pressed, toggle paint colour from 03 to 0A
; When any cell is clicked, if it is 00, set it to paint colour
; When any cell is clicked, if it is above 00, set it to 00

10 00 00 IMM SEL E0 01 ; Init - set display mode to RGB
10 00 00 IMM SEL 11 03 ; Init - set paint colour to 03
10 00 00 IMM SEL 10 01 ; finish init

11 03 03 KDE SEL 11 0A ; when paint is 03 and enter pressed, set to 0A
11 0A 0A KDE SEL 11 03 ; when paint is 0A and enter pressed, set to 03

00 00 00 OLC SEV 00 11 ; when cell 00 is 00 and clicked, set to paint colour
00 01 FF OLC SEL 00 00 ; when cell 00 is above 00 and clicked, set to 00
01 00 00 OLC SEV 01 11 ; when cell 01 is 00 and clicked, set to paint colour
01 01 FF OLC SEL 01 00 ; when cell 01 is above 00 and clicked, set to 00
02 00 00 OLC SEV 02 11 ; when cell 02 is 00 and clicked, set to paint colour
02 01 FF OLC SEL 02 00 ; when cell 02 is above 00 and clicked, set to 00
03 00 00 OLC SEV 03 11 ; when cell 03 is 00 and clicked, set to paint colour
03 01 FF OLC SEL 03 00 ; when cell 03 is above 00 and clicked, set to 00
04 00 00 OLC SEV 04 11 ; when cell 04 is 00 and clicked, set to paint colour
04 01 FF OLC SEL 04 00 ; when cell 04 is above 00 and clicked, set to 00
05 00 00 OLC SEV 05 11 ; when cell 05 is 00 and clicked, set to paint colour
05 01 FF OLC SEL 05 00 ; when cell 05 is above 00 and clicked, set to 00
06 00 00 OLC SEV 06 11 ; when cell 06 is 00 and clicked, set to paint colour
06 01 FF OLC SEL 06 00 ; when cell 06 is above 00 and clicked, set to 00
07 00 00 OLC SEV 07 11 ; when cell 07 is 00 and clicked, set to paint colour
07 01 FF OLC SEL 07 00 ; when cell 07 is above 00 and clicked, set to 00
08 00 00 OLC SEV 08 11 ; when cell 08 is 00 and clicked, set to paint colour
08 01 FF OLC SEL 08 00 ; when cell 08 is above 00 and clicked, set to 00
09 00 00 OLC SEV 09 11 ; when cell 09 is 00 and clicked, set to paint colour
09 01 FF OLC SEL 09 00 ; when cell 09 is above 00 and clicked, set to 00
0A 00 00 OLC SEV 0A 11 ; when cell 0A is 00 and clicked, set to paint colour
0A 01 FF OLC SEL 0A 00 ; when cell 0A is above 00 and clicked, set to 00
0B 00 00 OLC SEV 0B 11 ; when cell 0B is 00 and clicked, set to paint colour
0B 01 FF OLC SEL 0B 00 ; when cell 0B is above 00 and clicked, set to 00
0C 00 00 OLC SEV 0C 11 ; when cell 0C is 00 and clicked, set to paint colour
0C 01 FF OLC SEL 0C 00 ; when cell 0C is above 00 and clicked, set to 00
0D 00 00 OLC SEV 0D 11 ; when cell 0D is 00 and clicked, set to paint colour
0D 01 FF OLC SEL 0D 00 ; when cell 0D is above 00 and clicked, set to 00
0E 00 00 OLC SEV 0E 11 ; when cell 0E is 00 and clicked, set to paint colour
0E 01 FF OLC SEL 0E 00 ; when cell 0E is above 00 and clicked, set to 00
0F 00 00 OLC SEV 0F 11 ; when cell 0F is 00 and clicked, set to paint colour
0F 01 FF OLC SEL 0F 00 ; when cell 0F is above 00 and clicked, set to 00
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
