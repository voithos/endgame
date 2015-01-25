'use strict';

var cfg = require('./config');

module.exports = {
    init: function() {
        var self = this;
        self.ref = new Firebase(cfg.usersUrl);
    }
};
