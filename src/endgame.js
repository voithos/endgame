import './polyfills';

import Promise from 'promise';

import game from './game';
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
        scene.loadGameGeometry()
            .then(scene.setupBoard.bind(scene))
            .done();

        scene.beginRender();

        // In case of debug mode, we short-circuit the connection logic and go
        // straight into a local game.
        if (routes.isDebugMode()) {
            this.beginDebugGame();
            return;
        }

        let gameId = routes.parseGameId();
        if (gameId) {
            this.isHost = false;
            this.connectToGame(gameId);
        } else {
            this.isHost = true;
            this.setupGame();
        }
    },

    setupGame() {
        this.side = 'white';

        rtc.init()
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

        rtc.init()
            .then(game.join.bind(game, gameId))
            .then(rtc.connect.bind(rtc))
            .then(this.setupMedia.bind(this))
            .then(this.performMediaCalls.bind(this))
            .then(this.displayRemoteMedia.bind(this))
            .then(this.beginGame.bind(this))
            .done();
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
                            this.remoteHasMedia = data.hasMedia;
                            log('remote media request complete:', this.remoteHasMedia);

                            resolve();
                        } else {
                            log('ERROR: unknown event type', data.event);
                        }
                    }, /* once */ true);
                }),

                // Request local media
                media.init()
                    .then(() => {
                        this.localHasMedia = true;
                        log('local media granted');

                        media.playLocalStream();

                        rtc.sendData({
                            event: 'mediarequestcomplete',
                            hasMedia: true
                        });
                    }, () => {
                        this.localHasMedia = false;
                        log('local media denied');

                        rtc.sendData({
                            event: 'mediarequestcomplete',
                            hasMedia: false
                        });
                    })
            ]));
    },

    performMediaCalls() {
        log('performing remote media calls');

        if (!this.localHasMedia && !this.remoteHasMedia) {
            // No media to exchange
            return Promise.resolve();
        }

        // Because caller must provide mediaStream, we need to figure out if
        // we're the caller or not. If the host has a mediaStream, it will
        // always be the caller; otherwise, the friend will be.
        let isCaller = (this.isHost && this.localHasMedia) ||
            (!this.isHost && !this.remoteHasMedia && this.localHasMedia);

        return rtc.performMediaCall(
            isCaller,
            this.localHasMedia && media.localMediaStream
        );
    },

    displayRemoteMedia(call) {
        return new Promise((resolve, unused_reject) => {
            if (this.remoteHasMedia) {
                call.on('stream', (remoteMediaStream) => {
                    let video = media.configureRemoteStream(remoteMediaStream);
                    scene.addFriendScreen(this.side, video);
                    resolve();
                });
            } else {
                scene.addFriendScreen(this.side);
                resolve();
            }
        });
    },

    beginGame() {
        log('commencing game');

        views.showStatusScreen()
            .then(() => new Promise((resolve, unused_reject) => {
                // Begin chess game
                this.chess = new Chess();
                this.isMyTurn = this.side === 'white';

                scene.addTileControls(/* legalCallback */ pos => {
                    return this.chess.moves({ square: pos, verbose: true });
                }, /* moveCallback */ (from, to, opt_promotion) => {
                    let move = this.chess.move({
                        from: from,
                        to: to,
                        promotion: opt_promotion
                    });

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
                    }
                }, /* onPromotion */ () => {
                    return views.showPromotionScreen(this.side)
                });

                const afterMove = move => {
                    this.isMyTurn = !this.isMyTurn;
                    if (routes.isDebugMode()) {
                        this.side = this.side === 'white' ? 'black' : 'white';
                    }
                    scene.performGraphicalMove(move);

                    // TODO: Check for game end
                };

                if (!routes.isDebugMode()) {
                    rtc.addDataListener((data, unused_conn) => {
                        if (data.event === 'chessmove') {
                            if (!this.isMyTurn) {
                                // Apply remove move
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
        this.side = 'white';
        scene.setPlayCameraPos(this.side);
        this.beginGame();
    }
};

window.endgame = endgame;

endgame.main();
