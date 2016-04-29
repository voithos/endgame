import Promise from 'promise';
import cfg from './config';

export default {
    create(hostId) {
        this.ref = new Firebase(cfg.gamesUrl);
        this.gameRef = this.ref.push();
        this.gameRef.set({ hostId: hostId });
        this.gameRef.onDisconnect().remove();
        return Promise.resolve(this.gameRef.key());
    },

    join(gameId) {
        this.ref = new Firebase(cfg.gamesUrl);
        this.gameRef = this.ref.child(gameId);

        return new Promise((resolve, reject) => {
            this.gameRef.once('value', snapshot => {
                let val = snapshot.val();
                if (!val) {
                    // TODO: Handle rejection, show error message.
                    reject();
                    return;
                }
                this.gameRef.remove();
                this.gameRef = null;
                resolve(snapshot.val().hostId);
            });
        });
    }
};
