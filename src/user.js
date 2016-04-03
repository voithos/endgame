import cfg from './config';

export default {
    init() {
        this.ref = new Firebase(cfg.usersUrl);
    }
};
