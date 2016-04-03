import cfg from './config';

export default {
    init: function() {
        let self = this;
        self.ref = new Firebase(cfg.usersUrl);
    }
};
