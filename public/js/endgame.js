(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"./src/endgame.js":[function(require,module,exports){
(function (global){
'use strict';

var user = require('./user');
var game = require('./game');

var Endgame = {
    main: function() {
    }
};

global.Endgame = Endgame;

Endgame.main();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./game":"/home/daisy/Projects/ss15-black-kite/src/game.js","./user":"/home/daisy/Projects/ss15-black-kite/src/user.js"}],"/home/daisy/Projects/ss15-black-kite/src/game.js":[function(require,module,exports){
'use strict';

var settings = require('./settings');

module.exports = {
    createNew: function(hostId) {
        this.ref = new Firebase(settings.gamesUrl);
        this.gameRef = this.ref.push();
        this.gameRef.set({ hostId: hostId });
    }
};

},{"./settings":"/home/daisy/Projects/ss15-black-kite/src/settings.js"}],"/home/daisy/Projects/ss15-black-kite/src/settings.js":[function(require,module,exports){
'use strict';

var DB_BASE_URL = 'https://endgame-chess.firebaseio.com';
module.exports = {
    dbBaseUrl: DB_BASE_URL,
    usersUrl: DB_BASE_URL + '/users',
    gamesUrl: DB_BASE_URL + '/games'
};

},{}],"/home/daisy/Projects/ss15-black-kite/src/user.js":[function(require,module,exports){
'use strict';

var settings = require('./settings');

module.exports = {
    init: function() {
        this.ref = new Firebase(settings.usersUrl);
    }
};

},{"./settings":"/home/daisy/Projects/ss15-black-kite/src/settings.js"}]},{},["./src/endgame.js"]);
