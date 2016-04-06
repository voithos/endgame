import Promise from 'promise';
import _ from 'lodash';
import cfg from './config';
import routes from './routes';

export default {
    init() {
        this.peer = new Peer({
            key: cfg.peerJsKey,
            secure: !routes.isDevMode(),
            config: {
                iceServers: cfg.iceServers
            },
            debug: 2 // Print warnings and errors
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

    performMediaCall(isCaller, localMediaStream) {
        return new Promise((resolve, unused_reject) => {
            if (isCaller) {
                this.call = this.peer.call(this.remoteId, localMediaStream);
                resolve(this.call);
            } else {
                this.peer.on('call', call => {
                    this.call = call;

                    if (localMediaStream) {
                        call.answer(localMediaStream);
                    }
                    resolve(this.call);
                });
            }
        });
    }
};
