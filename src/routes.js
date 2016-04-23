import _ from 'lodash';

import utils from './utils';

export default {
    parts: utils.queryStringParts(window.location.search),

    parseGameId() {
        return _.last(utils.pathParts(window.location.pathname)) ||
            window.location.hash.substring(1);
    },

    genGameUrl(gameId) {
        let url = window.location.protocol + '//' + window.location.hostname +
            (window.location.port ? ':' + window.location.port : '');

        let hash = this.isDevMode() ? '#' : '';

        return `${url}/${hash}${gameId}`;
    },

    isDevMode() {
        return window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
    },

    isDebugMode() {
        return this.parts['debug'] === 'true';
    },

    getDebugSide() {
        return this.parts['side'];
    }
};
