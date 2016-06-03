import Promise from 'promise';
import cfg from './config';
import log from './log';

export default {
    init() {
        this.ref = new Firebase(cfg.dbBaseUrl);
        return new Promise((resolve, reject) => {
            this.ref.authAnonymously((error, unused_authData) => {
                if (error) {
                    log(`Firebase auth failed: ${error}`);
                    reject();
                } else {
                    resolve();
                }
            }, {
                remember: 'sessionOnly'
            });
        });
    }
};
