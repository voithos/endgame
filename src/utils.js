'use strict';

var _ = require('lodash');

module.exports = {
    pathParts: function(path) {
        return _.filter(path.split('/'));
    },

    repeat: function(v, n) {
        return _.map(Array.apply(null, new Array(n)), this.identity.bind(null, v));
    },

    identity: function(v) {
        return v;
    }
};
