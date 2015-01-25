'use strict';

var Promise = require('promise');
var _ = require('lodash');

var utils = require('./utils');

module.exports = {
    parseGameId: function() {
        return _.last(utils.pathParts(window.location.pathname)) ||
            window.location.hash.substring(1);
    },

    genGameUrl: function(gameId) {
        var url = window.location.protocol + '//' + window.location.hostname +
            (window.location.port ? ':' + window.location.port : '');

        var hash = (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1') ? '#' : '';

        return url + '/' + hash + gameId;
    }
};
