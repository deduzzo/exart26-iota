/**
 * `tasks/config/copy`
 *
 * Custom implementation using Node.js fs to avoid
 * grunt-contrib-copy Symbol bug on Node.js >= 20
 *
 */
module.exports = function(grunt) {

  grunt.registerTask('copy:dev', 'Copy assets to .tmp/public', function() {
    var fs = require('fs');
    var path = require('path');

    function copyRecursive(src, dest, filterExt) {
      if (!fs.existsSync(src)) { return; }
      var stats = fs.statSync(src);
      if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(function(child) {
          copyRecursive(path.join(src, child), path.join(dest, child), filterExt);
        });
      } else {
        var ext = path.extname(src).toLowerCase();
        if (filterExt && filterExt.indexOf(ext) !== -1) { return; }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }

    // Copy assets to .tmp/public (excluding .coffee and .less files)
    copyRecursive(
      path.resolve('assets'),
      path.resolve('.tmp/public'),
      ['.coffee', '.less']
    );

    // Copy bootstrap CSS from node_modules to assets/dependencies
    copyRecursive(
      path.resolve('node_modules/bootstrap/dist/css'),
      path.resolve('assets/dependencies/bootstrap/dist/css'),
      null
    );

    // Copy bootstrap JS from node_modules to assets/dependencies
    copyRecursive(
      path.resolve('node_modules/bootstrap/dist/js'),
      path.resolve('assets/dependencies/bootstrap/dist/js'),
      null
    );

    grunt.log.ok('Copied assets to .tmp/public/');
  });

  grunt.registerTask('copy:build', 'Copy .tmp/public to www', function() {
    var fs = require('fs');
    var path = require('path');

    function copyRecursive(src, dest) {
      if (!fs.existsSync(src)) { return; }
      var stats = fs.statSync(src);
      if (stats.isDirectory()) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(function(child) {
          copyRecursive(path.join(src, child), path.join(dest, child));
        });
      } else {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(src, dest);
      }
    }

    copyRecursive(path.resolve('.tmp/public'), path.resolve('www'));
    grunt.log.ok('Copied .tmp/public to www/');
  });

};
