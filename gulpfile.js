'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var browserify = require('browserify');
var watchify = require('watchify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var connect = require('gulp-connect');


var bundler = watchify(browserify(getMainScript(), watchify.args));
bundler.on('update', bundle);

gulp.task('js', bundle);
gulp.task('server', server);
gulp.task('default', ['server', 'js']);

function server() {
    connect.server({
        root: './public'
    });
}

function bundle() {
    return bundler.bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source('./public/js/endgame.js'))
        .pipe(buffer())
        // .pipe(sourcemaps.init({ loadMaps: true }))
            // .pipe(uglify())
        // .pipe(sourcemaps.write('../'))
        .pipe(gulp.dest('./'));
}

function getMainScript() {
    return require('./package.json').main;
}
