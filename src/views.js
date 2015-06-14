'use strict';

let Promise = require('promise');

let routes = require('./routes');
let log = require('./log');

module.exports = {
    showWaitScreen: function(gameId) {
        let self = this;

        self.waitScreen = new Vue({
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

    showMediaScreen: function() {
        let self = this;
        $('#waitscreen').modal('hide');

        $('#mediascreen').modal({
            backdrop: false,
            keyboard: false
        });

        return Promise.resolve();
    },

    showStatusScreen: function() {
        let self = this;
        $('#mediascreen').modal('hide');

        return Promise.resolve();
    }
};
