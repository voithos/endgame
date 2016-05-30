import _ from 'lodash';

export default {
    adjectives: [ 'autumn', 'hidden', 'bitter', 'misty', 'silent', 'empty', 'dry', 'dark', 'summer', 'icy', 'delicate', 'quiet', 'white', 'cool', 'spring', 'winter', 'patient', 'twilight', 'dawn', 'crimson', 'wispy', 'weathered', 'blue', 'billowing', 'broken', 'cold', 'damp', 'falling', 'frosty', 'green', 'long', 'late', 'lingering', 'bold', 'little', 'morning', 'muddy', 'old', 'red', 'rough', 'still', 'small', 'sparkling', 'throbbing', 'shy', 'wandering', 'withered', 'wild', 'black', 'young', 'holy', 'solitary', 'fragrant', 'aged', 'snowy', 'proud', 'floral', 'restless', 'divine', 'polished', 'ancient', 'purple', 'lively', 'nameless' ],
    nouns: [ 'waterfall', 'river', 'breeze', 'moon', 'rain', 'wind', 'sea', 'morning', 'snow', 'lake', 'sunset', 'pine', 'shadow', 'leaf', 'dawn', 'glitter', 'forest', 'hill', 'cloud', 'meadow', 'sun', 'glade', 'bird', 'brook', 'butterfly', 'bush', 'dew', 'dust', 'field', 'fire', 'flower', 'firefly', 'feather', 'grass', 'haze', 'mountain', 'night', 'pond', 'darkness', 'snowflake', 'silence', 'sound', 'sky', 'shape', 'surf', 'thunder', 'violet', 'water', 'wildflower', 'wave', 'water', 'resonance', 'sun', 'wood', 'dream', 'cherry', 'tree', 'fog', 'frost', 'voice', 'paper', 'frog', 'smoke', 'star' ],

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
        while ((match = search.exec(queryString))) {
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
    },

    randomReadableId() {
        let adjective = this.adjectives[Math.random() * this.adjectives.length | 0];
        let noun = this.nouns[Math.random() * this.nouns.length | 0];
        let num = Math.random() * 100 | 0;
        return `${adjective}-${noun}-${num}`;
    }
};
