'use strict';

var settings = require('./settings');

module.exports = {
    init: function() {
        this.ref = new Firebase(settings.usersUrl);
    }
};
