'use strict';

var _ = require('lodash');
var utils = require('./utils');

var DB_BASE_URL = 'https://endgame-chess.firebaseio.com';

var BOARD_SIZE = 8;
var RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];
var FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
var LAYOUT = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

/* Helper functions */
var genPiece = function(vs) {
    var pos = vs[0];
    var type = vs[1];
    return {
        pos: pos.join(''),
        type: type
    };
};

var genRank = function(rank, rankPieces) {
    return _.map(
        _.zip(
            _.zip(FILES, utils.repeat(rank, BOARD_SIZE)),
            rankPieces
        ),
        genPiece
    );
};

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

    pieces: ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'],
    assets: ['board'],

    ranks: RANKS,
    files: FILES,

    startPosition: {
        white: (
            // Pawns
            genRank('2', utils.repeat('pawn', BOARD_SIZE)).concat(
                // Higher pieces
                genRank('1', LAYOUT)
            )
        ),
        black: (
            // Pawns
            genRank('7', utils.repeat('pawn', BOARD_SIZE)).concat(
                // Higher pieces
                genRank('8', LAYOUT)
            )
        )
    },

    rankToOffset: _.zipObject(RANKS, _.range(BOARD_SIZE)),
    fileToOffset: _.zipObject(FILES, _.range(BOARD_SIZE)),

    gameOpts: {
        boardScale: 4.7,
        boardStartOffset: 16.5,
        tileSize: 4.7,
        pieceYOffset: 2,

        cameraStartPos: { x: 30, y: 15, z: 30 }
    }
};
