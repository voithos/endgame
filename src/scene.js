'use strict';

var Promise = require('promise');

var settings = require('./settings');
var log = require('./log');

module.exports = {
    init: function() {
        var self = this;
        self.scene = new THREE.Scene();
        self.camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000
        );

        self.renderer = self.createRenderer();
        self.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(self.renderer.domElement);
    },

    createRenderer: function() {
        // Choose between WebGL and Canvas renderer based on availability
        var self = this;
        return self.webglAvailable() ?
            new THREE.WebGLRenderer() :
            new THREE.CanvasRenderer();
    },

    webglAvailable: function() {
        try {
            var canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (
                canvas.getContext('webgl') ||
                canvas.getContext('experimental-webgl')
            ));
        } catch (e) {
            return false;
        }
    },

    createGameGeometry: function() {
        var self = this;
        var geometry = new THREE.BoxGeometry(1, 1, 1);
        var material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        self.cube = new THREE.Mesh(geometry, material);
        self.scene.add(self.cube);

        self.camera.position.z = 5;
    },

    beginRender: function() {
        var self = this;
        self.render = self.render.bind(self);
        self.previousTime = new Date().getTime();
        self.requestId = requestAnimationFrame(self.render);
    },

    render: function(timestamp) {
        var self = this;

        self.requestId = requestAnimationFrame(self.render);

        // Compute delta time
        var now = new Date().getTime();
        var delta = now - self.previousTime;
        self.previousTime = now;

        // Animations
        self.cube.rotation.x += 0.1;
        self.cube.rotation.y += 0.1;

        self.renderer.render(self.scene, self.camera);
    }
};
