'use strict';

var Promise = require('promise');
var log = require('./log');

module.exports = {
    showWaitScreen: function(gameId) {
        log('the gameid is', gameId);
        var self = this;

        var url = window.location.protocol + '//' + window.location.hostname +
            (window.location.port ? ':' + window.location.port : '');
        var gameUrl = url + '/' + gameId;

        self.waitScreen = new Vue({
            el: '#waitscreen',
            data: {
                link: gameUrl
            }
        });

        $('#waitscreen').modal({
            backdrop: false,
            keyboard: false
        });

        return Promise.resolve();
    }
};
