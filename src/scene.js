'use strict';

var Promise = require('promise');
var _ = require('lodash');

var cfg = require('./config');
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
        self.setInitialCameraPos();
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
        light.position.set(20, 20, 10);
        self.scene.add(light);
    },

    setInitialCameraPos: function() {
        var self = this;
        self.camera.position.x = cfg.gameOpts.cameraStartPos.x;
        self.camera.position.y = cfg.gameOpts.cameraStartPos.y;
        self.camera.position.z = cfg.gameOpts.cameraStartPos.z;
        self.camera.lookAt(new THREE.Vector3(0, 0, 0));
    },

    loadGameGeometry: function() {
        var self = this;
        self.meshes = {};

        // Load all pieces
        return Promise.all(_.map(cfg.pieces.concat(cfg.assets), function(assets) {
            return new Promise(function(resolve, reject) {
                var loader = new THREE.JSONLoader();
                loader.load('data/' + assets + '.json', function(geometry, materials) {
                    var mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));

                    self.meshes[assets] = mesh;
                    log('done loading', assets);

                    resolve(mesh);
                });
            });
        }));
    },

    setupBoard: function() {
        var self = this;

        self.pieces = {};

        // Add board
        self.board = new THREE.Object3D();
        self.board.add(self.meshes.board);
        self.board.scale.set(
            cfg.gameOpts.boardScale,
            cfg.gameOpts.boardScale,
            cfg.gameOpts.boardScale
        );

        self.scene.add(self.board);

        // Add pieces for both sides
        _.forEach(cfg.startPosition, function(pieces, side) {
            _.forEach(pieces, function(piece, i) {
                self.addPiece(piece.pos, piece.type, side);
            });
        });
    },

    addPiece: function(pos, type, side) {
        log('creating', type, side);

        var self = this;
        var object = new THREE.Object3D();
        object.add(self.meshes[type].clone());
        object.position.setY(cfg.gameOpts.pieceYOffset);

        self.setPiecePosition(object, pos);

        // Rotate white
        if (side === 'white') {
            object.rotation.y = Math.PI;
        }

        self.scene.add(object);
        self.pieces[pos] = {
            type: type,
            side: side,
            object: object
        };
    },

    setPiecePosition: function(object, pos) {
        var offsetX = cfg.fileToOffset[pos[0]];
        var offsetZ = cfg.rankToOffset[pos[1]];

        object.position.setX(-cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize);
        object.position.setZ(cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize);
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
