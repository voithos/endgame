import Promise from 'promise';
import _ from 'lodash';
import cfg from './config';

export default {
    init: function() {
        let self = this;
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
        let self = this;

        return new Promise(function(resolve, reject) {
            self.peer.on('connection', function(conn) {
                self.conn = conn;
                self.remoteId = conn.peer;
                self.setupDataBus(conn);
                resolve(conn);
            });
        });
    },

    connect: function(hostId) {
        let self = this;
        let conn = self.peer.connect(hostId, {
            reliable: true
        });
        self.conn = conn;
        self.remoteId = conn.peer;
        self.setupDataBus(conn);
        return Promise.resolve(conn);
    },

    setupDataBus: function(conn) {
        let self = this;

        self.queuedData = [];
        self.listeners = [];

        conn.on('open', function() {
            conn.on('data', function(data) {
                let listeners = self.listeners.slice();

                _.forEach(listeners, function(listener) {
                    listener.fn.call(self, data, conn);

                    if (listener.once) {
                        let idx = self.listeners.indexOf(listener);
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
        let self = this;
        self.listeners.push({
            fn: fn,
            once: once
        });
    },

    sendData: function(data) {
        let self = this;

        if (self.conn.open) {
            self.conn.send(data);
        } else {
            // If the channel isn't open yet, queue the data
            self.queuedData.push(data);
        }
    },

    performMediaCall: function(isCaller, localMediaStream) {
        let self = this;

        return new Promise(function(resolve, reject) {
            if (isCaller) {
                self.call = self.peer.call(self.remoteId, localMediaStream);
                resolve(self.call);
            } else {
                self.peer.on('call', function(call) {
                    self.call = call;

                    if (localMediaStream) {
                        call.answer(localMediaStream);
                    }
                    resolve(self.call);
                });
            }
        });
    }
};
