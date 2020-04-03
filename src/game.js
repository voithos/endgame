import Promise from 'promise';
import cfg from './config';
import log from './log';
import utils from './utils';

export default {
    create(hostId) {
        return new Promise((resolve, unused_reject) => {
            let data = {hostId: hostId};
            this.ref = firebase.database().refFromURL(cfg.gamesUrl);

            const attemptGenerateId = () => {
                // Attempt to generate a readable ID.
                let gameId = utils.randomReadableId();
                this.gameRef = this.ref.child(gameId);

                this.gameRef.transaction(
                    currentData => {
                        // If no data exists, overwrite it.
                        if (currentData === null) {
                            return data;
                        }
                        // Else, abort transaction (return `undefined`).
                    },
                    (error, committed) => {
                        // If the transaction was a successful, resolve.
                        // Otherwise, retry.
                        if (committed) {
                            this.gameRef.onDisconnect().remove();
                            resolve(this.gameRef.key);
                        } else {
                            // TODO: Unmanaged recursion (albeit async).
                            attemptGenerateId();
                        }
                    });
            };
            attemptGenerateId();
        });
    },

    join(gameId) {
        this.ref = firebase.database().refFromURL(cfg.gamesUrl);
        this.gameRef = this.ref.child(gameId);

        return new Promise((resolve, reject) => {
            this.gameRef.once('value').then(snapshot => {
                let val = snapshot.val();
                if (!val) {
                    log(`ERROR: failed to load game ${gameId}`);
                    reject(['join', gameId]);
                    return;
                }
                this.gameRef.remove();
                this.gameRef = null;
                resolve(snapshot.val().hostId);
            });
        });
    }
};
