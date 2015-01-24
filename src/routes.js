'use strict';

var Promise = require('promise');
var _ = require('lodash');

var settings = require('./settings');
var utils = require('./utils');

module.exports = {
    parseGameId: function() {
        return _.last(utils.pathParts(window.location.pathname)) ||
            window.location.hash.substring(1);
    }
};
