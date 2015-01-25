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

        rtc.init()
            .then(game.create.bind(game))
            .then(views.showWaitScreen.bind(views))
            .then(rtc.listen.bind(rtc))
            .then(self.setupMedia.bind(self))
            .done();
    },

    connectToGame: function(gameId) {
        var self = this;

        rtc.init()
            .then(game.join.bind(game, gameId))
            .then(rtc.connect.bind(rtc))
            .then(self.setupMedia.bind(self))
            .done();
    },

    setupMedia: function(conn) {
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
                        .then(function(localMediaStream) {
                            self.localHasMedia = true;
                            log('local media granted');

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
    }
};

global.endgame = endgame;

endgame.main();
