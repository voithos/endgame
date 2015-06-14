'use strict';

var gulp = require('gulp');
var gutil = require('gulp-util');
var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var less = require('gulp-less');
var watch = require('gulp-watch');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var connect = require('gulp-connect');
var plumber = require('gulp-plumber');
var prettyHrtime = require('pretty-hrtime');
var pkg = require('./package.json');


/** Available tasks. */
gulp.task('js', bundle);
gulp.task('css', compileCss);
gulp.task('watchCss', watchCss);
gulp.task('server', server);
gulp.task('default', ['server', 'js', 'css', 'watchCss']);

// Setup watchify bundler object.
var bundler = watchify(
    browserify(pkg.main, watchify.args)
        .transform(babelify)
);
bundler.on('update', bundle);

function bundle() {
    bundleLogger.watch();
    bundleLogger.start();

    return bundler.bundle()
        .on('end', bundleLogger.end.bind(bundleLogger))
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source('./public/js/endgame.js'))
        .pipe(buffer())
        // sourcemaps reference fails because web server root is different
        // from project root - seems to be issue with gulp-sourcemaps
        // .pipe(sourcemaps.init({ loadMaps: true }))
            // .pipe(uglify())
        // .pipe(sourcemaps.write('../'))
        .pipe(gulp.dest('./'));
}

function compileCss() {
    return gulp.src('./src/less/endgame.less')
        .pipe(plumber())
        .pipe(less())
        .pipe(gulp.dest('./public/css/'));
}

function watchCss() {
    gulp.watch('./src/less/*.less', ['css']);
}

function server() {
    connect.server({
        root: './public'
    });
}

var bundleLogger = (function() {
    var startTime;
    return {
        start: function() {
            startTime = process.hrtime();
            gutil.log('Bundling', gutil.colors.green(pkg.main) + '...');
        },
        watch: function() {
            gutil.log('Watching files required by', gutil.colors.yellow(pkg.name));
        },
        end: function() {
            var taskTime = process.hrtime(startTime);
            var prettyTime = prettyHrtime(taskTime);
            gutil.log('Bundled', gutil.colors.green(pkg.main), 'in', gutil.colors.magenta(prettyTime));
        }
    };
})();
