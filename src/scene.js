'use strict';

var Promise = require('promise');
var _ = require('lodash');

var settings = require('./settings');
var log = require('./log');

module.exports = {
    init: function() {
        var self = this;
        self.scene = new THREE.Scene();
        self.camera = new THREE.PerspectiveCamera(
            45, window.innerWidth / window.innerHeight, 0.1, 1000
        );

        self.renderer = self.createRenderer();
        self.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(self.renderer.domElement);

        self.addLighting();
        self.camera.position.y = 5;
        self.camera.position.z = 20;
    },

    createRenderer: function() {
        // Choose between WebGL and Canvas renderer based on availability
        var self = this;
        return self.webglAvailable() ?
            new THREE.WebGLRenderer({ antialias: true }) :
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

    addLighting: function() {
        var self = this;
        var light = new THREE.DirectionalLight();
        light.position.set(0, 0, 1);
        self.scene.add(light);
    },

    loadGameGeometry: function() {
        var self = this;
        self.meshes = {};

        // Load all pieces
        return Promise.all(_.map(settings.pieces, function(piece) {
            return new Promise(function(resolve, reject) {
                var loader = new THREE.JSONLoader();
                loader.load('data/' + piece + '.json', function(geometry, materials) {
                    var object = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));

                    self.meshes[piece] = object;
                    log('done loading', piece);

                    resolve(object);
                });
            });
        }));
    },

    setupBoard: function() {
        var self = this;

        _.forEach(settings.pieces, function(piece, i) {
            var model = new THREE.Object3D();
            model.add(self.meshes[piece]);
            model.position.setX(-10 + i * 4);

            self.scene.add(model);
        });
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

        self.renderer.render(self.scene, self.camera);
    }
};
