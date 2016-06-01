import Promise from 'promise';
import cfg from './config';

export default {
    init() {
        this.ref = new Firebase(cfg.dbBaseUrl);
        return new Promise((resolve, reject) => {
            this.ref.authAnonymously((error, unused_authData) => {
                if (error) {
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
