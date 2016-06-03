import Promise from 'promise';
import _ from 'lodash';
import cfg from './config';
import log from './log';
import routes from './routes';

export default {
    init() {
        this.peer = new Peer({
            firebaseURL: cfg.peerJsBackendUrl,
            secure: !routes.isDevMode(),
            config: {
                iceServers: cfg.iceServers
            },
            debug: 2 // Print warnings and errors
        });

        this.peer.on('error', err => {
            log(`PeerJS error: ${err.type}`);
        });

        return new Promise((resolve, unused_reject) => {
            this.peer.on('open', resolve);
        });
    },

    listen() {
        return new Promise((resolve, unused_reject) => {
            this.peer.on('connection', conn => {
                this.conn = conn;
                this.remoteId = conn.peer;
                this.setupDataBus(conn);
                resolve(conn);
            });
        });
    },

    connect(hostId) {
        let conn = this.peer.connect(hostId, {
            reliable: true
        });
        this.conn = conn;
        this.remoteId = conn.peer;
        this.setupDataBus(conn);
        return Promise.resolve(conn);
    },

    setupDataBus(conn) {
        this.queuedData = [];
        this.listeners = [];

        conn.on('error', err => {
            log(`PeerJS data connection error: ${err}`);
        });

        conn.on('open', () => {
            conn.on('data', data => {
                let listeners = this.listeners.slice();

                _.forEach(listeners, listener => {
                    listener.fn.call(this, data, conn);

                    if (listener.once) {
                        let idx = this.listeners.indexOf(listener);
                        if (idx !== -1) {
                            this.listeners.splice(idx, 1);
                        }
                    }
                });
            });

            _.forEach(this.queuedData, data => {
                this.conn.send(data);
            });
        });
    },

    addDataListener(fn, once) {
        this.listeners.push({
            fn: fn,
            once: once
        });
    },

    sendData(data) {
        if (this.conn.open) {
            this.conn.send(data);
        } else {
            // If the channel isn't open yet, queue the data
            this.queuedData.push(data);
        }
    },

    setupMedia(call) {
        call.on('error', err => {
            log(`PeerJS media connection error: ${err}`);
        });
    },

    performMediaCall(isCaller, localMediaStream) {
        return new Promise((resolve, unused_reject) => {
            if (isCaller) {
                this.call = this.peer.call(this.remoteId, localMediaStream);
                this.setupMedia(this.call);
                resolve(this.call);
            } else {
                this.peer.on('call', call => {
                    this.call = call;
                    this.setupMedia(this.call);

                    if (localMediaStream) {
                        call.answer(localMediaStream);
                    }
                    resolve(this.call);
                });
            }
        });
    }
};
