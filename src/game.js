import Promise from 'promise';
import cfg from './config';

export default {
    create(hostId) {
        this.ref = new Firebase(cfg.gamesUrl);
        this.gameRef = this.ref.push();
        this.gameRef.set({ hostId: hostId });
        // Setup cleanup function.
        window.addEventListener('beforeunload', unused_e => {
            this.gameRef.remove();
        });
        return Promise.resolve(this.gameRef.key());
    },

    join(gameId) {
        this.ref = new Firebase(cfg.gamesUrl);
        this.gameRef = this.ref.child(gameId);

        return new Promise((resolve, unused_reject) => {
            this.gameRef.once('value', snapshot => {
                this.gameRef.remove();
                this.gameRef = null;
                resolve(snapshot.val().hostId);
            });
        });
    }
};
