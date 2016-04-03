import Promise from 'promise';
import cfg from './config';
import log from './log';

export default {
    create: function(hostId) {
        let self = this;
        self.ref = new Firebase(cfg.gamesUrl);
        self.gameRef = self.ref.push();
        self.gameRef.set({ hostId: hostId });
        return Promise.resolve(self.gameRef.key());
    },

    join: function(gameId) {
        let self = this;
        self.ref = new Firebase(cfg.gamesUrl);
        self.gameRef = self.ref.child(gameId);

        return new Promise(function(resolve, reject) {
            self.gameRef.once('value', function(snapshot) {
                resolve(snapshot.val().hostId);
            });
        });
    }
};
