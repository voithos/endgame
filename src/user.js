import Promise from 'promise';
import cfg from './config';
import log from './log';

export default {
    init() {
        return firebase.auth()
            .setPersistence(firebase.auth.Auth.Persistence.SESSION)
            .then(() => firebase.auth().signInAnonymously())
            .catch((error) => {
                log(`Firebase auth failed: ${error}`);
            });
    }
};
