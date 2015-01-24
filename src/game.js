'use strict';

var settings = require('./settings');

module.exports = {
    createNew: function(hostId) {
        this.ref = new Firebase(settings.gamesUrl);
        this.gameRef = this.ref.push();
        this.gameRef.set({ hostId: hostId });
    }
};
