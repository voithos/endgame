'use strict';

var DB_BASE_URL = 'https://endgame-chess.firebaseio.com';

module.exports = {
    dbBaseUrl: DB_BASE_URL,
    usersUrl: DB_BASE_URL + '/users',
    gamesUrl: DB_BASE_URL + '/games',
    peerJsKey: 'e47332e9vb4yrpb9',

    iceServers: [
        { 'url': 'stun.l.google.com:19302' },
        { 'url': 'stun1.l.google.com:19302' },
        { 'url': 'stun2.l.google.com:19302' },
        { 'url': 'stun3.l.google.com:19302' },
        { 'url': 'stun4.l.google.com:19302' }
    ],

    pieces: ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king']
};
