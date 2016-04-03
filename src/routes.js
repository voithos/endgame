import _ from 'lodash';

import utils from './utils';

export default {
    parseGameId() {
        return _.last(utils.pathParts(window.location.pathname)) ||
            window.location.hash.substring(1);
    },

    genGameUrl(gameId) {
        let url = window.location.protocol + '//' + window.location.hostname +
            (window.location.port ? ':' + window.location.port : '');

        // When developing locally, the local web server doesn't have
        // routing capabilities, so just use the fragment
        let hash = (window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1') ? '#' : '';

        return url + '/' + hash + gameId;
    }
};
