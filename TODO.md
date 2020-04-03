# todo

## Code
- switch to Material lite
- upgrade code to ES2015

## Game
- animate tiles glow-in/out
- look into adding background music (akin to Gratia Mundi)
- improve move sound
- add ability to disable sound
- add support for touch gestures instead of tap and hold
! persist state to server to allow re-connecting to games
? change board and pieces models
? add computer mode
? keep history of moves, perhaps display it somehow

## Bugs
! for browsers that don't support WebRTC (safari), have better error message
! portrait mode doesn't work (touchscreen)
! test on multiple browsers
- bug where enabling audio/video in mobile device appears to kill the connection, but
  thereafter works
- navigator.getUserMedia deprecated
? fix strange SSAO rendering issue (actually, looks to be shadow issue - unrelated to SSAO pass)
