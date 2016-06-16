import './polyfills';

import Promise from 'promise';

import game from './game';
import user from './user';
import media from './media';
import routes from './routes';
import rtc from './rtc';
import scene from './scene';
import cfg from './config';
import views from './views';
import log from './log';

let endgame = {
    config: cfg,

    main() {
        scene.init(routes.isDebugMode());
        scene.loadGameAssets()
            .then(scene.setupBoard.bind(scene))
            .done();

        scene.beginRender();

        // In case of debug mode, we short-circuit the connection logic and go
        // straight into a local game.
        if (routes.isDebugMode()) {
            this.beginDebugGame();
            return;
        }

        user.init().then(() => {
            let gameId = routes.parseGameId();
            if (gameId) {
                this.isHost = false;
                routes.resetPath();
                this.connectToGame(gameId);
            } else {
                this.isHost = true;
                this.setupGame();
            }
        });
    },

    setupGame() {
        this.side = 'white';

        rtc.init(this.onConnClose.bind(this))
            .then(game.create.bind(game))
            .then(views.showWaitScreen.bind(views))
            .then(rtc.listen.bind(rtc))
            .then(this.setupMedia.bind(this))
            .then(this.performMediaCalls.bind(this))
            .then(this.displayRemoteMedia.bind(this))
            .then(this.beginGame.bind(this))
            .done();
    },

    connectToGame(gameId) {
        this.side = 'black';

        rtc.init(this.onConnClose.bind(this))
            .then(game.join.bind(game, gameId))
            .then(rtc.connect.bind(rtc))
            .then(this.setupMedia.bind(this))
            .then(this.performMediaCalls.bind(this))
            .then(this.displayRemoteMedia.bind(this))
            .then(this.beginGame.bind(this))
            .catch(this.handleError.bind(this))
            .done();
    },

    handleError([type, data]) {
        if (type === 'join') {
            views.showMessage(
                    'Game Not Found',
                    `Alas, game room <code>${data}</code> doesn't seem to exist.
                    <p>Perhaps check the spelling? Or <a href="/">create a new game room</a>.`,
                    'danger');
        } else {
            throw Error(`unknown error type: ${type}`);
        }
    },

    setupMedia() {
        log('setting up the media');

        return views.showMediaScreen()
            // We need to wait for both the local and remote media to be resolved
            .then(() => Promise.all([
                // Wait for notice from remote regarding media
                new Promise((resolve, unused_reject) => {
                    rtc.addDataListener((data, unused_conn) => {
                        if (data.event === 'mediarequestcomplete') {
                            this.remoteHasVideo = data.hasVideo;
                            this.remoteHasAudio = data.hasAudio;
                            this.remoteHasMedia = data.hasMedia;
                            log(`remote media request complete (hasMedia: ${this.remoteHasMedia}, ` +
                                `hasVideo: ${this.remoteHasVideo}, hasAudio: ${this.remoteHasAudio})`);

                            resolve();
                        } else {
                            log('ERROR: unknown event type', data.event);
                        }
                    }, /* once */ true);
                }),

                // Request local media
                media.init()
                    .then(() => {
                        this.localHasVideo = media.hasLocalVideo();
                        this.localHasAudio = media.hasLocalAudio();
                        this.localHasMedia = this.localHasVideo || this.localHasAudio;
                        log(`local media granted (hasVideo: ${this.localHasVideo}, ` +
                            `hasAudio: ${this.localHasAudio})`);

                        if (this.localHasVideo) {
                            media.playLocalStream();
                        }

                        rtc.sendData({
                            event: 'mediarequestcomplete',
                            hasMedia: this.localHasMedia,
                            hasVideo: this.localHasVideo,
                            hasAudio: this.localHasAudio
                        });
                    }, () => {
                        this.localHasMedia = false;
                        this.localHasVideo = false;
                        this.localHasAudio = false;
                        log('local media denied or unavilable');

                        rtc.sendData({
                            event: 'mediarequestcomplete',
                            hasMedia: false,
                            hasVideo: false,
                            hasAudio: false
                        });
                    })
            ]));
    },

    performMediaCalls() {
        log('performing remote media calls');

        if (!this.localHasMedia && !this.remoteHasMedia) {
            // No media to exchange
            log('no media to exchange');
            return Promise.resolve();
        }

        // Because caller must provide mediaStream, we need to figure out if
        // we're the caller or not. If the host has a (video) mediaStream, it will
        // always be the caller; otherwise, the friend will be.
        //
        // In addition, add a preference for the peer that has video, as it
        // seems to only work reliably from the initial call.
        // TODO: Figure out why this is the case.
        let videoPeerExists = this.localHasVideo || this.remoteHasVideo;
        let isPreferredVideoPeer = (this.isHost && this.localHasVideo) ||
            (!this.isHost && !this.remoteHasVideo && this.localHasVideo);
        let isPreferredMediaPeer = (this.isHost && this.localHasMedia) ||
            (!this.isHost && !this.remoteHasMedia && this.localHasMedia);

        let isCaller = videoPeerExists ?
            isPreferredVideoPeer :
            isPreferredMediaPeer;
        log(`initial caller determined - isCaller: ${isCaller}`);

        return rtc.performMediaCall(
            isCaller,
            this.localHasMedia && media.localMediaStream
        );
    },

    displayRemoteMedia(call) {
        log('displaying remote media');
        return new Promise((resolve, unused_reject) => {
            if (this.remoteHasMedia) {
                call.on('stream', (remoteMediaStream) => {
                    // Configure media, even if it's audio-only.
                    let video = media.configureRemoteStream(remoteMediaStream);
                    scene.addFriendScreen(this.side, this.remoteHasVideo ? video : null);
                    log('media display complete');
                    resolve();
                });
            } else {
                log('no media; add empty friend screen');
                scene.addFriendScreen(this.side);
                resolve();
            }
        });
    },

    updateCapturedCount(move) {
        const mapping = {
            'p': 'pawn',
            'n': 'knight',
            'b': 'bishop',
            'r': 'rook',
            'q': 'queen'
        };
        // Check for standard capture (c) and en-passant (e).
        if (move.captured) {
            // The opposite color was captured.
            let color = move.color === 'w' ? 'black' : 'white';
            let piece = mapping[move.captured];
            this.capturedPieces[color][piece] += 1;
        }
    },

    beginGame() {
        log('commencing game');

        // Begin chess game
        this.chess = new Chess();
        this.capturedPieces = {
            'white': {'pawn': 0, 'knight': 0, 'bishop': 0, 'rook': 0, 'queen': 0},
            'black': {'pawn': 0, 'knight': 0, 'bishop': 0, 'rook': 0, 'queen': 0}
        };

        // Pass the object directly so that the view can bind to it.
        views.showStatusScreen(this.capturedPieces)
            .then(() => new Promise((resolve, unused_reject) => {
                this.isMyTurn = this.side === 'white';
                scene.movesEnabled = this.isMyTurn;

                scene.addTileControls(/* legalCallback */ pos => {
                    return this.chess.moves({ square: pos, verbose: true });
                }, /* moveCallback */ (from, to, opt_promotion) => {
                    let moveArgs = {
                        from: from,
                        to: to,
                        promotion: opt_promotion
                    };
                    let move = this.chess.move(moveArgs);

                    if (move) {
                        if (!routes.isDebugMode()) {
                            // Send move to remote
                            rtc.sendData({
                                event: 'chessmove',
                                move: move
                            });
                        }
                        afterMove(move);
                    } else {
                        log('ERROR: illegal move attempted locally - bug?');
                        log(moveArgs);
                    }
                }, /* onPromotion */ () => {
                    return views.showPromotionScreen(this.side)
                });

                const afterMove = move => {
                    this.isMyTurn = !this.isMyTurn;
                    scene.movesEnabled = this.isMyTurn || routes.isDebugMode();
                    scene.activeSide = scene.activeSide === 'white' ? 'black' : 'white';

                    if (routes.isDebugMode()) {
                        this.side = this.side === 'white' ? 'black' : 'white';
                    }
                    this.updateCapturedCount(move);
                    scene.performMove(move, this.chess.in_check());

                    this.checkGameOver();
                };

                if (!routes.isDebugMode()) {
                    rtc.addDataListener((data, unused_conn) => {
                        if (data.event === 'chessmove') {
                            if (!this.isMyTurn) {
                                // Apply remote move.
                                let move = this.chess.move(data.move);

                                if (move) {
                                    afterMove(move);
                                } else {
                                    log('ERROR: opponent attempted invalid move', data);
                                }
                            } else {
                                log('ERROR: opponent attempted to move on my turn');
                            }
                        } else {
                            log('ERROR: unknown event type', data.event);
                        }
                    });
                }
            }))
            .done();

    },

    beginDebugGame() {
        this.side = routes.getDebugSide() || 'white';
        scene.setPlayCameraPos(this.side);
        this.beginGame();
    },

    checkGameOver() {
        if (this.chess.game_over()) {
            scene.gameOver = true;

            // Game over! Determine cause, and display message.
            let reason = '';

            if (this.chess.in_checkmate()) {
                let winner = this.chess.turn() === 'w' ? 'Black' : 'White';
                reason = `Checkmate - ${winner} Wins`;
            } else if (this.chess.in_stalemate()) {
                reason = `Stalemate`;
            } else if (this.chess.insufficient_material()) {
                reason = `Draw - Insufficient Material`;
            } else if (this.chess.in_draw()) {
                // We already checked for insufficient material, so the only
                // remaining possibility is 50-move rule.
                reason = `Draw - 50-Move Rule`;
            }

            if (!reason) {
                log('ERROR: no game-end reason determined?');
            }
            views.showGameEndScreen(reason);
        }
    },

    onConnClose() {
        views.showAlert('The opponent has left the game.');
        setTimeout(() => {
            views.showAlert('To create a new game room, refresh the page.', '', 'info', 15000);
        }, 8000);
    }
};

window.endgame = endgame;

document.addEventListener('DOMContentLoaded', endgame.main.bind(endgame));
