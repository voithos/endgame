import _ from 'lodash';

export default {
    pathParts(path) {
        return _.filter(path.split('/'));
    },

    repeat(v, n) {
        return _.map(Array.apply(null, new Array(n)), this.identity.bind(null, v));
    },

    identity(v) {
        return v;
    }
};
