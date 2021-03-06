import './polyfills';

import Promise from 'promise';

import cfg from './config';
import game from './game';
import log from './log';
import media from './media';
import routes from './routes';
import rtc from './rtc';
import scene from './scene';
import user from './user';
import views from './views';

let endgame = {
    config: cfg,

    main() {
        // Initialize Firebase
        firebase.initializeApp(cfg.firebaseConfig);

        views.init();
        scene.init(routes.isDebugMode(), this.getQuality());
        scene.loadGameAssets().then(scene.setupBoard.bind(scene)).done();

        scene.beginRender();

        // In case of debug mode, we short-circuit the connection logic and go
        // straight into a local game.
        if (routes.isDebugMode()) {
            log('init debug mode');
            this.beginDebugGame();
            return;
        }

        user.init().then(() => {
            let gameId = routes.parseGameId();
            if (gameId) {
                log('gameId found - connecting to host');
                this.isHost = false;
                routes.resetPath();
                this.connectToGame(gameId);
            } else {
                log('no gameId - acting as host');
                this.isHost = true;
                this.setupGame();
            }
        });
    },

    setupGame() {
        this.side = 'white';

        rtc.init(this.onConnClose.bind(this))
            .then(game.create.bind(game))
            .then(gameId => {
                return views.showWaitScreen(
                    gameId, scene.quality, this.toggleQuality.bind(this));
            })
            .then(rtc.listen.bind(rtc))
            .then(this.setupMedia.bind(this))
            .then(this.performMediaCalls.bind(this))
            .then(this.displayRemoteMedia.bind(this))
            .then(this.beginGame.bind(this))
            // handleError isn't relevant here.
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

    handleError(error) {
        if (!Array.isArray(error)) {
            throw error;
        }
        const [type, data] = error;
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

        // Wait for notice from remote regarding media. We need to set up this
        // listener first because it needs to be ready before we attempt to set
        // up the local media streams.
        let remoteMediaPromise = new Promise((resolve, unused_reject) => {
            log('attaching remote media info listener');
            rtc.addDataListener((data, unused_conn) => {
                if (data.event === 'mediarequestcomplete') {
                    this.remoteHasVideo = data.hasVideo;
                    this.remoteHasAudio = data.hasAudio;
                    this.remoteHasMedia = data.hasMedia;
                    log(`remote media request complete (hasMedia: ${
                            this.remoteHasMedia}, ` +
                        `hasVideo: ${this.remoteHasVideo}, hasAudio: ${
                            this.remoteHasAudio})`);

                    resolve();
                } else if (data.event === 'mediareadyping') {
                    // Media pings are expected. Return 'true' to avoid
                    // auto-listener removal.
                    return true;
                } else {
                    log('ERROR: unknown event type', data.event);
                }
            }, /* once */ true);
        });

        return views
            .showMediaScreen()
            // First we make sure that the media listeners are attached by
            // synchronizing the peers via ping.
            .then(() => this.synchronizePing('mediareadyping'))
            // Then we wait for both the local and remote media to be resolved.
            .then(() => Promise.all([
                // Block on the attachment of remote media listener.
                remoteMediaPromise,

                // Now that we're synced, request local media.
                media.init().then(
                    () => {
                        this.localHasVideo = media.hasLocalVideo();
                        this.localHasAudio = media.hasLocalAudio();
                        this.localHasMedia =
                            this.localHasVideo || this.localHasAudio;
                        log(`local media granted (hasVideo: ${
                                this.localHasVideo}, ` +
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
                    },
                    () => {
                        this.localHasMedia = false;
                        this.localHasVideo = false;
                        this.localHasAudio = false;
                        log('local media denied or unavailable');

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
        // we're the caller or not. If the host has a (video) mediaStream, it
        // will always be the caller; otherwise, the friend will be.
        //
        // In addition, add a preference for the peer that has video, as it
        // seems to only work reliably from the initial call.
        // TODO: Figure out why this is the case.
        let videoPeerExists = this.localHasVideo || this.remoteHasVideo;
        let isPreferredVideoPeer = (this.isHost && this.localHasVideo) ||
            (!this.isHost && !this.remoteHasVideo && this.localHasVideo);
        let isPreferredMediaPeer = (this.isHost && this.localHasMedia) ||
            (!this.isHost && !this.remoteHasMedia && this.localHasMedia);

        let isCaller =
            videoPeerExists ? isPreferredVideoPeer : isPreferredMediaPeer;
        let localMediaStream = this.localHasMedia && media.localMediaStream;
        log(`initial caller determined - isCaller: ${isCaller}`);

        if (isCaller) {
            return this.synchronizePing('mediacallping')
                .then(() => rtc.performMediaCall(isCaller, localMediaStream));
        } else {
            // Setup listener beforehand.
            let mediaCallPromise =
                rtc.performMediaCall(isCaller, localMediaStream);
            return this.synchronizePing('mediacallping')
                .then(() => mediaCallPromise);
        }
    },

    displayRemoteMedia(call) {
        log('displaying remote media');
        return new Promise((resolve, unused_reject) => {
            let addStream = (remoteMediaStream) => {
                // Configure media, even if it's audio-only.
                let video = media.configureRemoteStream(remoteMediaStream);
                scene.addFriendScreen(
                    this.side, this.remoteHasVideo ? video : null);
                log('media display complete');
                resolve();
            };

            if (this.remoteHasMedia) {
                // If the remote stream is already attached, grab it.
                if (call.remoteStream) {
                    log('remote media exists and is available');
                    addStream(call.remoteStream);
                } else {
                    log('remote media exists; setting up stream handler');
                    call.on('stream', (stream) => addStream(stream));
                }
            } else {
                log('no media; add empty friend screen');
                scene.addFriendScreen(this.side);
                resolve();
            }
        });
    },

    synchronizePing(pingName) {
        return new Promise((resolve, unused_reject) => {
            // Ping every half-second.
            let pingInterval = setInterval(() => {
                rtc.sendData({event: pingName});
            }, 500);

            // Listen for ping.
            log(`attaching ${pingName} listener; beginning ping`);
            rtc.addDataListener((data, unused_conn) => {
                if (data.event === pingName) {
                    log(`${pingName} ping received; detaching`);
                    clearInterval(pingInterval);
                    resolve();

                    // Send one last ping, to make sure that both peers get
                    // resolved.
                    rtc.sendData({event: pingName});
                } else {
                    log('ERROR: unknown event type', data.event);
                }
            }, /* once */ true);
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
            'white':
                {'pawn': 0, 'knight': 0, 'bishop': 0, 'rook': 0, 'queen': 0},
            'black':
                {'pawn': 0, 'knight': 0, 'bishop': 0, 'rook': 0, 'queen': 0}
        };

        // Pass the object directly so that the view can bind to it.
        views
            .showStatusScreen(
                this.capturedPieces, scene.quality,
                this.toggleQuality.bind(this))
            .then(
                () => new Promise((resolve, unused_reject) => {
                    this.isMyTurn = this.side === 'white';
                    scene.movesEnabled = this.isMyTurn;

                    scene.addTileControls(
                        /* legalCallback */
                        pos => {
                            return this.chess.moves(
                                {square: pos, verbose: true});
                        },
                        /* moveCallback */
                        (from, to, opt_promotion) => {
                            log(`performing move - from: ${from}, to: ${
                                to}, promo: ${opt_promotion}`);
                            let moveArgs = {
                                from: from,
                                to: to,
                                promotion: opt_promotion
                            };
                            let move = this.chess.move(moveArgs);

                            if (move) {
                                if (!routes.isDebugMode()) {
                                    // Send move to remote
                                    rtc.sendData(
                                        {event: 'chessmove', move: move});
                                }
                                afterMove(move);
                            } else {
                                log('ERROR: illegal move attempted locally - bug?');
                                log(moveArgs);
                            }
                        },
                        /* onPromotion */
                        () => {return views.showPromotionScreen(this.side)});

                    const afterMove = move => {
                        this.isMyTurn = !this.isMyTurn;
                        scene.movesEnabled =
                            this.isMyTurn || routes.isDebugMode();
                        scene.activeSide =
                            scene.activeSide === 'white' ? 'black' : 'white';

                        if (routes.isDebugMode()) {
                            this.side =
                                this.side === 'white' ? 'black' : 'white';
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
                                        log('ERROR: opponent attempted invalid move',
                                            data);
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
        let viewSide = routes.getDebugSide() || 'white';
        scene.setPlayCameraPos(viewSide);
        // Override side, since we want to be able to play both sides even when
        // we're black.
        this.side = scene.side = 'white';
        this.beginGame();
    },

    getQuality() {
        let forcedQuality = routes.getQuality();
        if (forcedQuality) {
            log(`forced quality: ${forcedQuality}`);
            this.setStoredQuality(forcedQuality);
            return forcedQuality;
        }

        let storedQuality = this.getStoredQuality();
        if (storedQuality) {
            return storedQuality;
        }

        // Default to 'high'.
        return 'high';
    },

    getStoredQuality() {
        if (window.localStorageAvailable()) {
            let quality = localStorage.getItem(cfg.qualityKey);
            if (quality) {
                log(`retrieved stored quality: ${quality}`);
            }
            return quality;
        }
        return null;
    },

    setStoredQuality(quality) {
        if (window.localStorageAvailable()) {
            log(`storing quality: ${quality}`);
            localStorage.setItem(cfg.qualityKey, quality);
        }
    },

    toggleQuality() {
        let newQuality = scene.quality === 'high' ? 'low' : 'high';
        this.setStoredQuality(newQuality);
        scene.setQuality(newQuality);
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

    onConnClose(explicit) {
        let msg = explicit ?
            'The opponent has left the game.' :
            'The opponent may have left the game, or the network is lagging.';
        views.showAlert(msg);
        setTimeout(() => {
            views.showAlert(
                'To create a new game room, refresh the page.', '', 'info',
                15000);
        }, 8000);
    }
};

window.endgame = endgame;

document.addEventListener('DOMContentLoaded', endgame.main.bind(endgame));
