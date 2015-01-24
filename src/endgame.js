'use strict';

var Promise = require('promise');
var _ = require('lodash');

var user = require('./user');
var game = require('./game');
var rtc = require('./rtc');
var utils = require('./utils');
var log = require('./log');

var Endgame = {
    main: function() {
        var self = this;

        var gameId = self.parseGameRoom();
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
            .then(self.showWaitScreen.bind(self))
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
    },

    showWaitScreen: function(gameId) {
        log('the game is', gameId);
        return Promise.resolve();
    },

    parseGameRoom: function() {
        return _.last(utils.pathParts(window.location.pathname)) ||
            window.location.hash.substring(1);
    }
};

global.Endgame = Endgame;

Endgame.main();
