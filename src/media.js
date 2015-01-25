'use strict';

var Promise = require('promise');
var cfg = require('./config');
var log = require('./log');

module.exports = {
    init: function() {
        var self = this;

        return new Promise(function(resolve, reject) {
            if (!navigator.getUserMedia) {
                return reject();
            }

            navigator.getUserMedia({
                video: {
                    mandatory: {
                        maxWidth: cfg.mediaWidth,
                        maxHeight: cfg.mediaHeight,
                        minFrameRate: cfg.mediaMinFrameRate
                    }
                },
                audio: true
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
        self.playStream(self.localMediaStream, video);

        var started = false;
        video.addEventListener('canplay', function(ev) {
            if (!started && (video.videoHeight || video.videoWidth)) {
                started = true;

                video.width = cfg.localMediaWidth;
                video.height = video.videoHeight / (video.videoWidth / cfg.localMediaWidth);

                $('#localvideopanel').show('slow');
            }
        }, false);
    },

    configureRemoteStream: function(remoteMediaStream) {
        var self = this;
        self.remoteMediaStream = remoteMediaStream;

        var video = document.createElement('video');
        self.playStream(remoteMediaStream, video);

        return video;
    },

    playStream: function(mediaStream, video) {
        video.autoplay = true;

        // Handle older Firefox oddities
        if (navigator.mozGetUserMedia) {
            video.mozSrcObject = mediaStream;
        } else {
            video.src = window.URL.createObjectURL(mediaStream);
        }
    }
};
