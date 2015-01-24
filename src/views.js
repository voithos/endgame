'use strict';

var Promise = require('promise');
var settings = require('./settings');
var log = require('./log');

module.exports = {
    showWaitScreen: function(gameId) {
        log('the game is', gameId);
        return Promise.resolve();
    }
};
