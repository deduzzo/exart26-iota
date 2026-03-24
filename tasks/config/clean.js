/**
 * `tasks/config/clean`
 *
 * Custom implementation using Node.js fs.rmSync to avoid
 * grunt-contrib-clean Symbol bug on Node.js >= 20
 *
 */
module.exports = function(grunt) {

  grunt.registerTask('clean:dev', 'Clean .tmp/public directory', function() {
    var fs = require('fs');
    var path = require('path');
    var dir = path.resolve('.tmp/public');
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
    grunt.log.ok('Cleaned .tmp/public/');
  });

  grunt.registerTask('clean:build', 'Clean www directory', function() {
    var fs = require('fs');
    var path = require('path');
    var dir = path.resolve('www');
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    grunt.log.ok('Cleaned www/');
  });

  grunt.registerTask('clean:afterBuildProd', 'Clean prod build artifacts', function() {
    var fs = require('fs');
    var path = require('path');
    ['www/concat','www/min','www/hash','www/js','www/styles','www/templates','www/dependencies'].forEach(function(d) {
      var dir = path.resolve(d);
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    grunt.log.ok('Cleaned prod build artifacts');
  });

};
