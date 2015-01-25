'use strict';

var Promise = require('promise');

var routes = require('./routes');
var log = require('./log');

module.exports = {
    showWaitScreen: function(gameId) {
        var self = this;

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
        var self = this;
        $('#waitscreen').modal('hide');

        $('#mediascreen').modal({
            backdrop: false,
            keyboard: false
        });

        return Promise.resolve();
    }
};
