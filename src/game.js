'use strict';

var Promise = require('promise');
var settings = require('./settings');
var log = require('./log');

module.exports = {
    create: function(hostId) {
        var self = this;
        self.ref = new Firebase(settings.gamesUrl);
        self.gameRef = self.ref.push();
        self.gameRef.set({ hostId: hostId });
        return Promise.resolve(self.gameRef.key());
    },

    join: function(gameId) {
        var self = this;
        self.ref = new Firebase(settings.gamesUrl);
        self.gameRef = self.ref.child(gameId);

        return new Promise(function(resolve, reject) {
            self.gameRef.once('value', function(snapshot) {
                resolve(snapshot.val().hostId);
            });
        });
    }
};
