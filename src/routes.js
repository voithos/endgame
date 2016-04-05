import utils from './utils';

export default {
    parseGameId() {
        return window.location.hash.substring(1);
    },

    genGameUrl(gameId) {
        let url = window.location.protocol + '//' + window.location.hostname +
            (window.location.port ? ':' + window.location.port : '');

        return `${url}/#${gameId}`;
    },

    isDebugMode() {
        const parts = utils.queryStringParts(window.location.search);
        return parts['debug'] === 'true';
    }
};
