/**
 * requestAnimationFrame
 */
(function() {
    let lastTime = 0;
    let vendors = ['webkit', 'moz'];
    for(let x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
        window.cancelAnimationFrame =
          window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame)
        window.requestAnimationFrame = function(callback) {
            let currTime = new Date().getTime();
            let timeToCall = Math.max(0, 16 - (currTime - lastTime));
            let id = window.setTimeout(function() { callback(currTime + timeToCall); },
              timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };

    if (!window.cancelAnimationFrame)
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
})();

/**
 * getUserMedia
 */
(function() {
    navigator.getUserMedia  = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;
})();

/**
 * window.URL
 */
(function() {
    window.URL = window.URL || window.webkitURL;
})();

/**
 * Array.prototype.find
 */
(function() {
    if (!Array.prototype.find) {
        Array.prototype.find = function(predicate) {
            if (this === null) {
                throw new TypeError('Array.prototype.find called on null or undefined');
            }
            if (typeof predicate !== 'function') {
                throw new TypeError('predicate must be a function');
            }
            let list = Object(this);
            let length = list.length >>> 0;
            let thisArg = arguments[1];
            let value;

            for (let i = 0; i < length; i++) {
                value = list[i];
                if (predicate.call(thisArg, value, i, list)) {
                    return value;
                }
            }
            return undefined;
        };
    }
})();

/**
 * Date.now
 */
(function() {
    if (!Date.now) {
        Date.now = function() {
            return new Date().getTime();
        };
    }
})();

/**
 * localStorage
 */
(function() {
    window.localStorageAvailable = function() {
        try {
            let storage = window.localStorage;
            let x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return false;
        }
    };
})();
