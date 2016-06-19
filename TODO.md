# todo

## Code
- switch to Material lite
- upgrade code to ES2015
- upgrade to new Firebase sdk

## Game
! add low-quality mode for improved perf on weaker devices
- animate tiles glow-in/out
- look into adding background music (akin to Gratia Mundi)
- improve move sound
- add ability to disable sound
? change board and pieces models
? add computer mode
? keep history of moves, perhaps display it somehow
? persist state to server to allow re-connecting to games

## Bugs
! test on multiple browsers
- bug where enabling audio/video in mobile device appears to kill the connection, but
  thereafter works
- navigator.getUserMedia deprecated
? fix strange SSAO rendering issue (actually, looks to be shadow issue - unrelated to SSAO pass)
