'use strict';

require('./polyfills');

var Promise = require('promise');
var _ = require('lodash');

var user = require('./user');
var game = require('./game');
var media = require('./media');
var routes = require('./routes');
var rtc = require('./rtc');
var scene = require('./scene');
var cfg = require('./config');
var utils = require('./utils');
var views = require('./views');
var log = require('./log');

var endgame = {
    config: cfg,

    main: function() {
        var self = this;

        scene.init();
        scene.loadGameGeometry()
            .then(scene.setupBoard.bind(scene))
            .done();

        scene.beginRender();

        var gameId = routes.parseGameId();
        if (gameId) {
            self.isHost = false;
            self.connectToGame(gameId);
        } else {
            self.isHost = true;
            self.setupGame();
        }
    },

    setupGame: function() {
        var self = this;
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
        var self = this;
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

        var self = this;

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

        var self = this;

        if (!self.localHasMedia && !self.remoteHasMedia) {
            // No media to exchange
            return Promise.resolve();
        }

        // Because caller must provide mediaStream, we need to figure out if
        // we're the caller or not. If the host has a mediaStream, it will
        // always be the caller; otherwise, the friend will be.
        var isCaller = (self.isHost && self.localHasMedia) ||
            (!self.isHost && !self.remoteHasMedia && self.localHasMedia);

        return rtc.performMediaCall(
            isCaller,
            self.localHasMedia && media.localMediaStream
        );
    },

    displayRemoteMedia: function(call) {
        var self = this;

        return new Promise(function(resolve, reject) {
            if (self.remoteHasMedia) {
                call.on('stream', function(remoteMediaStream) {
                    var video = media.configureRemoteStream(remoteMediaStream);
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

        views.showStatusScreen();
    }
};

global.endgame = endgame;

endgame.main();
