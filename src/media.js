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
    },

    playLocalStream: function() {
        var self = this;

        var video = $('#localvideo').get(0);

        // Handle older Firefox oddities
        if (navigator.mozGetUserMedia) {
            video.mozSrcObject = self.localMediaStream;
        } else {
            video.src = window.URL.createObjectURL(self.localMediaStream);
        }

        var started = false;
        video.addEventListener('canplay', function(ev) {
            if (!started) {
                started = true;
                video.width = cfg.localMediaWidth;
                video.height = video.videoHeight / (video.videoWidth / cfg.localMediaWidth);

                $('#localvideopanel').show('slow');
            }
        }, false);
    }
};
