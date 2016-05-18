'use strict';

import _ from 'lodash';
import utils from './utils';

const DB_BASE_URL = 'https://endgame-chess.firebaseio.com';

const BOARD_SIZE = 8;
const SIDES = ['white', 'black'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const LAYOUT = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];

/* Helper functions */
let genPiece = function([pos, type]) {
    return {
        pos: pos.join(''),
        type
    };
};

let genRank = function(rank, rankPieces) {
    return _.map(
        _.zip(
            _.zip(FILES, utils.repeat(rank, BOARD_SIZE)),
            rankPieces
        ),
        genPiece
    );
};

export default {
    dbBaseUrl: DB_BASE_URL,
    usersUrl: DB_BASE_URL + '/users',
    gamesUrl: DB_BASE_URL + '/games',
    peerJsBackendUrl: DB_BASE_URL + '/peerjs',

    iceServers: [
        { 'url': 'stun:stun.l.google.com:19302' },
        { 'url': 'stun:stun1.l.google.com:19302' },
        { 'url': 'stun:stun2.l.google.com:19302' },
        { 'url': 'stun:stun3.l.google.com:19302' },
        { 'url': 'stun:stun4.l.google.com:19302' }
    ],

    localMediaWidth: 240,
    mediaWidth: 320,
    mediaHeight: 240,
    mediaMinFrameRate: 10,

    pieces: ['pawn', 'knight', 'bishop', 'rook', 'queen', 'king'],
    assets: ['board'],

    sides: SIDES,
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
        tileOpacity: 0.4,
        pieceYOffset: 1.7,

        cameraStartPos: { x: 30, y: 15, z: 30 },
        cameraPlayPos: { x: 0, y: 22, z: 45 },
        cameraPlayLookAt: { x: 0, y: 5, z: 0 },

        friendScreenSize: { x: 30, y: 20, z: 5 },
        friendScreenPos: { x: 0, y: 10, z: -30 },

        skyboxSize: { x: 150, y: 100, z: 200 },

        dirLightPos: { x: -25, y: 25, z: 25 },

        mirrorOpacity: 0.2,

        animationSpeed: 500
    },

    effects: {
        bloom: {
            strength: 3,
            kernel: 11,
            sigma: 5.0,
            resolution: 256
        },
        ssao: {
            clamp: 0.8,
            lumInfluence: 0.9
        }
    },

    colors: {
        pieces: {
            white: {
                color: 0xdddddd,
                emissive: 0x000000,
                specular: 0xaaaaaa
            },
            black: {
                color: 0x222222,
                emissive: 0x000000,
                specular: 0x111111
            }
        },

        tiles: {
            active: 0xffa500,
            legal: 0x7ac142,
            selected: 0x3a7a99,
            prevFrom: 0x62ccff,
            prevTo: 0xda2820
        },

        glow: {
            afterMove: 0x62ccff
        },

        clear: 'lightgray',
        skybox: 0xbababa,
        friendScreen: 0xdadada
    },

    loadingScreen: {
        backgroundColor: '#fff',
        fadeOutDuration: 2000
    }
};
