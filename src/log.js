'use strict';

let logEnabled = true;

module.exports = function() {
    if (global.console && logEnabled) {
        console.log.apply(console, Array.prototype.slice.call(arguments));
    }
};
