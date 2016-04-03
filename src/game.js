import Promise from 'promise';
import cfg from './config';
import log from './log';

export default {
    create: function(hostId) {
        this.ref = new Firebase(cfg.gamesUrl);
        this.gameRef = this.ref.push();
        this.gameRef.set({ hostId: hostId });
        return Promise.resolve(this.gameRef.key());
    },

    join: function(gameId) {
        this.ref = new Firebase(cfg.gamesUrl);
        this.gameRef = this.ref.child(gameId);

        return new Promise((resolve, reject) => {
            this.gameRef.once('value', function(snapshot) {
                resolve(snapshot.val().hostId);
            });
        });
    }
};
