import './polyfills';

import Promise from 'promise';
import _ from 'lodash';

import user from './user';
import game from './game';
import media from './media';
import routes from './routes';
import rtc from './rtc';
import scene from './scene';
import cfg from './config';
import utils from './utils';
import views from './views';
import log from './log';

let endgame = {
    config: cfg,

    main: function() {
        let self = this;

        scene.init();
        scene.loadGameGeometry()
            .then(scene.setupBoard.bind(scene))
            .done();

        scene.beginRender();

        let gameId = routes.parseGameId();
        if (gameId) {
            self.isHost = false;
            self.connectToGame(gameId);
        } else {
            self.isHost = true;
            self.setupGame();
        }
    },

    setupGame: function() {
        let self = this;
        self.side = 'white';

        rtc.init()
            .then(game.create.bind(game))
            .then(views.showWaitScreen.bind(views))
            .then(rtc.listen.bind(rtc))
            .then(self.setupMedia.bind(self))
            .then(self.performMediaCalls.bind(self))
            .then(self.displayRemoteMedia.bind(self))
            .then(self.beginGame.bind(self))
            .done();
    },

    connectToGame: function(gameId) {
        let self = this;
        self.side = 'black';

        rtc.init()
            .then(game.join.bind(game, gameId))
            .then(rtc.connect.bind(rtc))
            .then(self.setupMedia.bind(self))
            .then(self.performMediaCalls.bind(self))
            .then(self.displayRemoteMedia.bind(self))
            .then(self.beginGame.bind(self))
            .done();
    },

    setupMedia: function() {
        log('setting up the media');

        let self = this;

        return views.showMediaScreen()
            .then(function() {
                // We need to wait for both the local and remote media to be resolved

                return Promise.all([
                    // Wait for notice from remote regarding media
                    new Promise(function(resolve, reject) {
                        rtc.addDataListener(function(data, conn) {
                            if (data.event === 'mediarequestcomplete') {
                                self.remoteHasMedia = data.hasMedia;
                                log('remote media request complete:', self.remoteHasMedia);

                                resolve();
                            } else {
                                log('ERROR: unknown event type', data.event);
                            }
                        }, true);
                    }),

                    // Request local media
                    media.init()
                        .then(function() {
                            self.localHasMedia = true;
                            log('local media granted');

                            media.playLocalStream();

                            rtc.sendData({
                                event: 'mediarequestcomplete',
                                hasMedia: true
                            });
                        }, function() {
                            self.localHasMedia = false;
                            log('local media denied');

                            rtc.sendData({
                                event: 'mediarequestcomplete',
                                hasMedia: false
                            });
                        })
                ]);
            });
    },

    performMediaCalls: function() {
        log('performing remote media calls');

        let self = this;

        if (!self.localHasMedia && !self.remoteHasMedia) {
            // No media to exchange
            return Promise.resolve();
        }

        // Because caller must provide mediaStream, we need to figure out if
        // we're the caller or not. If the host has a mediaStream, it will
        // always be the caller; otherwise, the friend will be.
        let isCaller = (self.isHost && self.localHasMedia) ||
            (!self.isHost && !self.remoteHasMedia && self.localHasMedia);

        return rtc.performMediaCall(
            isCaller,
            self.localHasMedia && media.localMediaStream
        );
    },

    displayRemoteMedia: function(call) {
        let self = this;

        return new Promise(function(resolve, reject) {
            if (self.remoteHasMedia) {
                call.on('stream', function(remoteMediaStream) {
                    let video = media.configureRemoteStream(remoteMediaStream);
                    scene.addFriendScreen(self.side, video);
                    resolve();
                });
            } else {
                scene.addFriendScreen(self.side);
                resolve();
            }
        });
    },

    beginGame: function() {
        log('commencing game');

        let self = this;

        views.showStatusScreen()
            .then(function() {
                return new Promise(function(resolve, reject) {
                    // Begin chess game
                    self.chess = new Chess();
                    self.isMyTurn = self.side === 'white';

                    scene.addTileControls(function(pos) {
                        return self.chess.moves({ square: pos, verbose: true });
                    }, function(from, to) {
                        let move = self.chess.move({ from: from, to: to });

                        if (move) {
                            // Send move to remote
                            rtc.sendData({
                                event: 'chessmove',
                                move: move
                            });
                            afterMove(move);
                        } else {
                            log('ERROR: illegal move attempted locally - bug?');
                        }
                    });

                    let afterMove = function(move) {
                        self.isMyTurn = !self.isMyTurn;
                        scene.performGraphicalMove(move);

                        // TODO: Check for game end
                    };

                    rtc.addDataListener(function(data, conn) {
                        if (data.event === 'chessmove') {
                            if (!self.isMyTurn) {
                                // Apply remove move
                                let move = self.chess.move(data.move);

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
                });
            })
            .done();

    }
};

global.endgame = endgame;

endgame.main();
