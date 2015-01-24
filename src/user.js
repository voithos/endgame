'use strict';

var settings = require('./settings');

module.exports = {
    init: function() {
        var self = this;
        self.ref = new Firebase(settings.usersUrl);
    }
};
