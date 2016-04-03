import Promise from 'promise';

import routes from './routes';
import log from './log';

export default {
    showWaitScreen(gameId) {
        this.waitScreen = new Vue({
            el: '#waitscreen',
            data: {
                link: routes.genGameUrl(gameId)
            }
        });

        $('#waitscreen').modal({
            backdrop: false,
            keyboard: false
        });

        return Promise.resolve();
    },

    showMediaScreen() {
        $('#waitscreen').modal('hide');

        $('#mediascreen').modal({
            backdrop: false,
            keyboard: false
        });

        return Promise.resolve();
    },

    showStatusScreen() {
        $('#mediascreen').modal('hide');

        return Promise.resolve();
    }
};
