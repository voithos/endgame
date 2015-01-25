'use strict';

var Promise = require('promise');
var cfg = require('./config');

module.exports = {
    init: function() {
        var self = this;
        self.peer = new Peer({
            key: cfg.peerJsKey,
            config: {
                iceServers: cfg.iceServers
            }
        });

        return new Promise(function(resolve, reject) {
            self.peer.on('open', resolve);
        });
    },

    listen: function() {
        var self = this;

        return new Promise(function(resolve, reject) {
            self.peer.on('connection', function(conn) {
                self.conn = conn;
                resolve(conn);
            });
        });
    },

    connect: function(hostId) {
        var self = this;
        return Promise.resolve(self.peer.connect(hostId, {
            reliable: true
        }));
    }
};
