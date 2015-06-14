'use strict';

let cfg = require('./config');

module.exports = {
    init: function() {
        let self = this;
        self.ref = new Firebase(cfg.usersUrl);
    }
};
