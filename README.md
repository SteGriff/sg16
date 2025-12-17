# SG16 State Machine

This is a whimsical primitive state machine based computing environment for writing 8 bit programs. This takes inspiration from uxn/varvara and other small computing experiments.

## Memory

The memory is structured from 0x00 to 0xFF like so:

 + 0x0X - Grid-displayed memory
 + 0x1X - Non-displayed memory
 + 0xE0 - Display mode

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

### 0xE0 - Display Mode

The display mode byte can be set to one of the following:

| Byte | Description
| ---- | -----------
| 0x00 | Hex literal display - show "00", "02", "AA", etc in the grid cell
| 0x01 | RGB - 8 bit colour using bits RRRGGGBB
| 0x02 | ASCII - corresponding ASCII character for the value 0-255. Only show displayable values
| 0x03 | Icons - display one of the custom 255 icons from a library (TBC)

### 0xE2 - Click buffer

Contains the last click type set by event 2x (1, 2, or 3), see Events.

### 0xE3 - Key buffer

Contains the last key set by event 3x or 4x - see Events and Key IDs.

## Programs

### Instruction format

Every line is 7 bytes:

`PL PM PX EV OP TG VL`

 + PreconditionLocation (PL)
 + PreconditionMinBound inclusive (PM)
 + PreconditionMaxBound inclusive (PX)
 + Event (EV)
 + Operation (OP)
 + Target (TG) - memory address 0x00 to 0xFF
 + Value (VL) - literal value or variable address depending on OP

Mental model: When PL is between PM and PX, and EV happens (to PL), do OP on TG with VL.

Currently, PM and PX are constrained to constant (literal) values rather than checking a variable.

### Precondition

The global state 0x10 starts as 00, so init instructions of the program ordinarily begin with `10 00 00`: "The Global State == 0"

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

We divide a second into 16 parts. 

So event 11 (A1T) is after 1/16th of a second, and event 1F (AFT) is after a whole second. 

Multiple seconds can be tracked by incrementing another counter after F ticks then checking the value of that as a precondition to the state machine, etc...

#### Key IDs

Only a subset of keyboard keys are registered:

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

Comments can be written after `;`

### Display modes

```
;PL PM PX EV OP TG VL
 10 00 00 00 00 05 01 ; Init (global state is 0) immediately set Grid 5 to 01
 10 00 00 00 00 03 E0 ; Set right column decoratively
 10 00 00 00 00 07 FC ; 
 10 00 00 00 00 0B 1C ; 
 10 00 00 00 00 0F 03 ; 
 10 00 00 00 00 0C 61 ; Set bottom row decoratively
 10 00 00 00 00 0D 62 ; 
 10 00 00 00 00 0E 63 ; 
 10 00 00 00 02 10 01 ; End init by adding 1 to global state
 05 00 02 21 02 05 01 ; When grid 5 is 0-2, and left clicked, increment it
 05 01 03 22 04 05 01 ; When grid 5 is 1-3, and right clicked, decrement it
 00 00 00 21 01 E0 05 ; When grid 0 is clicked, set display mode to value of grid 5
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
; Let 12 be a copy of the lastKey struck or FF for null
; When a key 0-9 is struck, type the value of that key at the cursor position
10 00 00 IMM SEL 12 FF ; init lastKey to null
10 00 00 IMM SEL 10 01 ; finish init

11 00 0F KDF SEV 12 E3 ; copy E3 to 12
12 00 0F IMM ADL 11 01 ; advance cursor
11 10 FF IMM SEL 11 00 ; or wrap around to 00
12 00 FE IMM SEL 12 FF ; clear lastKey
00 00 FF OLC SEL 12 FF ; "fix" by clicking grid 0 if broken, lol

11 00 00 IMM SEV 00 E3 ; if cursor at 00, write key to grid 00
11 01 01 IMM SEV 01 E3 ; if cursor at 01, write key to grid 01
11 02 02 IMM SEV 02 E3 ; if cursor at 02, write key to grid 02
11 03 03 IMM SEV 03 E3 ; if cursor at 03, write key to grid 03
11 04 04 IMM SEV 04 E3 ; if cursor at 04, write key to grid 04
11 05 05 IMM SEV 05 E3 ; if cursor at 05, write key to grid 05
11 06 06 IMM SEV 06 E3 ; if cursor at 06, write key to grid 06
11 07 07 IMM SEV 07 E3 ; if cursor at 07, write key to grid 07
11 08 08 IMM SEV 08 E3 ; if cursor at 08, write key to grid 08
11 09 09 IMM SEV 09 E3 ; if cursor at 09, write key to grid 09
11 0A 0A IMM SEV 0A E3 ; if cursor at 0A, write key to grid 0A
11 0B 0B IMM SEV 0B E3 ; if cursor at 0B, write key to grid 0B
11 0C 0C IMM SEV 0C E3 ; if cursor at 0C, write key to grid 0C
11 0D 0D IMM SEV 0D E3 ; if cursor at 0D, write key to grid 0D
11 0E 0E IMM SEV 0E E3 ; if cursor at 0E, write key to grid 0E
11 0F 0F IMM SEV 0F E3 ; if cursor at 0F, write key to grid 0F

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

### Calculator

```
; States: 00=init, 01=getOp1, 02=getOp2, 03=calc
; Variables: 11=operand1, 12=operand2, 13=sum, 14=diff

; STATE 00: Init
10 00 00 IMM SEL E0 02 ; set display mode to ASCII
10 00 00 IMM SEL 0C 2B ; paint + in cell C (0x2B = +)
10 00 00 IMM SEL 0D 2D ; paint - in cell D (0x2D = -)
10 00 00 IMM SEL 00 30 ; paint 0 in cell 0
10 00 00 IMM SEL 01 30 ; paint 0 in cell 1
10 00 00 IMM SEL 11 FF ; init op1 to FF (null)
10 00 00 IMM SEL 12 FF ; init op2 to FF (null)
10 00 00 IMM SEL 13 00 ; init sum to 0
10 00 00 IMM SEL 14 00 ; init diff to 0
10 00 00 IMM SEL 10 01 ; go to state 01 (ready)

; STATE 01: Get op 1 
10 01 01 KDF SEV 11 E3 ; copy key to op1
11 00 0F IMM SEV 00 E3 ; set grid 0 to E3
11 00 0F IMM ADL 00 30 ; grid 0 -> ASCII
11 00 0F IMM SEL 10 02 ; go state 2

; STATE 02: Get op 2
10 02 02 KDF SEV 12 E3 ; copy key to op1
12 00 0F IMM SEV 01 E3 ; set grid 1 to E3
12 00 0F IMM ADL 01 30 ; grid 1 -> ASCII
12 00 0F IMM SEL 10 03 ; go state 3

; Plus
0C 00 FF OLC SEV 13 11 ; set sum = op1
13 01 FF IMM ADV 13 12 ; sum += op2
13 01 FF IMM ADL 13 30 ; sum -> ascii
13 01 FF IMM SEV 05 13 ; display sum in grid 5
13 01 FF IMM SEL 10 00 ; re-init

; Minus
0D 00 FF OLC SEV 14 11 ; set diff = op1
14 01 FF IMM SUV 14 12 ; diff -= op2
14 01 FF IMM ADL 14 30 ; diff -> ascii
14 01 FF IMM SEV 05 14 ; display diff in grid 5
14 01 FF IMM SEL 10 00 ; re-init
```

### Walkabout

```
; Variables: 11=position (grid index 0x00-0x0F)

; STATE 00: Init
10 00 00 IMM SEL E0 02 ; set display mode to ASCII
10 00 00 IMM SEL 11 05 ; start at grid 5 (middle)
10 00 00 IMM SEL 10 01 ; go to state 01 (ready)

; Movement keys - update position
10 01 FF KDA SUL 11 04 ; Up/W: move up (subtract 4)
10 01 FF KDB ADL 11 04 ; Down/S: move down (add 4)
10 01 FF KDC SUL 11 01 ; Left/A: move left (subtract 1)
10 01 FF KDD ADL 11 01 ; Right/D: move right (add 1)

; Display: draw O where position is, space everywhere else
11 00 00 IMM SEL 00 4F ; if pos=0, draw O in cell 0
11 01 0F IMM SEL 00 20 ; else draw space
11 01 01 IMM SEL 01 4F ; if pos=1, draw O in cell 1
11 00 00 IMM SEL 01 20 ; else draw space before
11 02 FF IMM SEL 01 20 ; ...or after
11 02 02 IMM SEL 02 4F ; if pos=2, draw O in cell 2
11 00 01 IMM SEL 02 20 ; else draw space before
11 03 FF IMM SEL 02 20 ; ...or after
11 03 03 IMM SEL 03 4F ; if pos=3, draw O in cell 3
11 00 02 IMM SEL 03 20 
11 04 FF IMM SEL 03 20 
11 04 04 IMM SEL 04 4F ; if pos=4, draw O in cell 4
11 00 03 IMM SEL 04 20 
11 05 FF IMM SEL 04 20 
11 05 05 IMM SEL 05 4F ; if pos=5, draw O in cell 5
11 00 04 IMM SEL 05 20 
11 06 FF IMM SEL 05 20 
11 06 06 IMM SEL 06 4F ; if pos=6, draw O in cell 6
11 00 05 IMM SEL 06 20 
11 07 FF IMM SEL 06 20 
11 07 07 IMM SEL 07 4F ; if pos=7, draw O in cell 7
11 00 06 IMM SEL 07 20 
11 08 FF IMM SEL 07 20 
11 08 08 IMM SEL 08 4F ; if pos=8, draw O in cell 8
11 00 07 IMM SEL 08 20 
11 09 FF IMM SEL 08 20 
11 09 09 IMM SEL 09 4F ; if pos=9, draw O in cell 9
11 00 08 IMM SEL 09 20 
11 0A FF IMM SEL 09 20 
11 0A 0A IMM SEL 0A 4F ; if pos=A, draw O in cell A
11 00 09 IMM SEL 0A 20 
11 0B FF IMM SEL 0A 20 
11 0B 0B IMM SEL 0B 4F ; if pos=B, draw O in cell B
11 00 0A IMM SEL 0B 20 
11 0C FF IMM SEL 0B 20 
11 0C 0C IMM SEL 0C 4F ; if pos=C, draw O in cell C
11 00 0B IMM SEL 0C 20 
11 0D FF IMM SEL 0C 20 
11 0D 0D IMM SEL 0D 4F ; if pos=D, draw O in cell D
11 00 0C IMM SEL 0D 20 
11 0E FF IMM SEL 0D 20 
11 0E 0E IMM SEL 0E 4F ; if pos=E, draw O in cell E
11 00 0D IMM SEL 0E 20 
11 0F FF IMM SEL 0E 20 
11 0F 0F IMM SEL 0F 4F ; if pos=F, draw O in cell F
11 00 0E IMM SEL 0F 20 
11 00 FF IMM SEL 0F 20 
```

### Colours

```
10 00 00 IMM SEL E0 01 ; Set RGB mode

; Paint a load of colours
10 00 00 IMM SEL 00 E0
10 00 00 IMM SEL 01 EC
10 00 00 IMM SEL 02 F8
10 00 00 IMM SEL 03 FC
10 00 00 IMM SEL 04 BC
10 00 00 IMM SEL 05 1C
10 00 00 IMM SEL 06 1E
10 00 00 IMM SEL 07 3A
10 00 00 IMM SEL 08 1B
10 00 00 IMM SEL 09 0F
10 00 00 IMM SEL 0A 07
10 00 00 IMM SEL 0B 47
10 00 00 IMM SEL 0C 63
10 00 00 IMM SEL 0D C3
10 00 00 IMM SEL 0E E2
10 00 00 IMM SEL 0F E1

10 00 00 IMM SEL 10 01 ; End init

00 00 FF OLC SEL E0 00 ; Click grid 0 for hex 
01 00 FF OLC SEL E0 01 ; Click grid 1 for rgb
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
