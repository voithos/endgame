'use strict';

require('./polyfills');

var Promise = require('promise');
var _ = require('lodash');

var user = require('./user');
var game = require('./game');
var routes = require('./routes');
var rtc = require('./rtc');
var scene = require('./scene');
var utils = require('./utils');
var views = require('./views');
var log = require('./log');

var Endgame = {
    main: function() {
        var self = this;

        scene.init();
        scene.loadGameGeometry()
            .then(scene.setupBoard.bind(scene));

        scene.beginRender();

        var gameId = routes.parseGameId();
        if (gameId) {
            self.connectToGame(gameId);
        } else {
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
        log('setup the media now');
        global.conn = conn;

        conn.on('data', function(data) {
            log(data);
        });
    }
};

global.Endgame = Endgame;

Endgame.main();
