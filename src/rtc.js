'use strict';

var Promise = require('promise');
var _ = require('lodash');
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
                self.setupDataBus(conn);
                resolve(conn);
            });
        });
    },

    connect: function(hostId) {
        var self = this;
        var conn = self.peer.connect(hostId, {
            reliable: true
        });
        self.conn = conn;
        self.setupDataBus(conn);
        return Promise.resolve(conn);
    },

    setupDataBus: function(conn) {
        var self = this;

        self.queuedData = [];
        self.listeners = [];

        conn.on('open', function() {
            conn.on('data', function(data) {
                var listeners = self.listeners.slice();

                _.forEach(listeners, function(listener) {
                    listener.fn.call(self, data, conn);

                    if (listener.once) {
                        var idx = self.listeners.indexOf(listener);
                        if (idx !== -1) {
                            self.listeners.splice(idx, 1);
                        }
                    }
                });
            });

            _.forEach(self.queuedData, function(data) {
                self.conn.send(data);
            });
        });
    },

    addDataListener: function(fn, once) {
        var self = this;
        self.listeners.push({
            fn: fn,
            once: once
        });
    },

    sendData: function(data) {
        var self = this;

        if (self.conn.open) {
            self.conn.send(data);
        } else {
            // If the channel isn't open yet, queue the data
            self.queuedData.push(data);
        }
    }
};
