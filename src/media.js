'use strict';

var Promise = require('promise');
var cfg = require('./config');

module.exports = {
    init: function() {
        var self = this;

        return new Promise(function(resolve, reject) {
            if (!navigator.getUserMedia) {
                return reject();
            }

            navigator.getUserMedia({
                video: true, audio: true
            }, function(localMediaStream) {
                // Acquired
                self.localMediaStream = localMediaStream;
                resolve(localMediaStream);
            }, function() {
                // Rejected
                reject();
            });
        });
    }
};
