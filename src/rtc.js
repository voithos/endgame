import Promise from 'promise';
import _ from 'lodash';
import cfg from './config';
import log from './log';
import routes from './routes';

export default {
    init(onCloseFn = null) {
        if (!onCloseFn) {
            onCloseFn = (unused_explicit) => {};
        }
        this.onCloseFn = onCloseFn;
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
        window.foo = this;
        return Promise.resolve(conn);
    },

    setupDataBus(conn) {
        this.queuedData = [];
        this.listeners = [];

        conn.on('error', err => {
            log(`PeerJS data connection error: ${err}`);
        });

        conn.on('open', () => {
            // `close` doesn't fire on Firefox, so we use drop detection.
            this.startDropDetection();
            conn.on('close', () => this.onDrop(/* explicit */ true));

            conn.on('data', data => {
                let listeners = this.listeners.slice();
                if (!listeners.length) {
                    log(`WARNING: no listeners registered for data: ${data}`);
                }

                _.forEach(listeners, listener => {
                    let value = listener.fn.call(this, data, conn);
                    if (value === false) return false;

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

    startDropDetection() {
        // Unfortunately, Firefox doesn't change the RTCPeerConnection state
        // when a connection is lost, so we have to manually infer this.

        const checkInterval = cfg.connDropCheckInterval; // milliseconds
        const timeoutIntervals = cfg.connDropTimeout;
        let countdown = timeoutIntervals;

        this.dropDetectionId = setInterval(() => {
            this.sendData({
                event: 'heartbeat'
            });

            if (!countdown) {
                this.onDrop(/* explicit */ false);
            }
            countdown -= 1;
        }, checkInterval);

        this.addDataListener((data, unused_conn) => {
            if (data.event === 'heartbeat') {
                // Reset countdown.
                countdown = timeoutIntervals;
                // Stop other listeners.
                return false;
            }
        }, /* once */ false, /* first */ true);
    },

    onDrop(explicit) {
        // Cancel drop detection.
        clearInterval(this.dropDetectionId);

        // Avoid duplicate drops.
        if (this.dropped) return;
        this.dropped = true;

        this.onCloseFn(explicit);
    },

    addDataListener(fn, once, first) {
        let method = first ? 'unshift' : 'push';
        this.listeners[method]({
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
