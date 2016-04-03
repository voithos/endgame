import _ from 'lodash';

export default {
    pathParts(path) {
        return _.filter(path.split('/'));
    },

    queryStringParts(queryString) {
        const plus = /\+/g;
        const search = /([^&=]+)=?([^&]*)/g;
        const decode = s => decodeURIComponent(s.replace(plus, ' '));
        if (queryString.charAt(0) === '?') {
            queryString = queryString.slice(1);
        }
        let parts = {};
        let match;
        while (match = search.exec(queryString)) {
            let [, key, value] = match;
            parts[decode(key)] = decode(value);
        }
        return parts;
    },

    repeat(v, n) {
        return _.map(Array.apply(null, new Array(n)), this.identity.bind(null, v));
    },

    identity(v) {
        return v;
    }
};
