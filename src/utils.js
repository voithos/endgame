'use strict';

var _ = require('lodash');

module.exports = {
    pathParts: function(path) {
        return _.filter(path.split('/'));
    }
};
