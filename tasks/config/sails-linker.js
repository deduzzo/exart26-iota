/**
 * `tasks/config/sails-linker`
 *
 * ---------------------------------------------------------------
 *
 * Automatically inject <script> tags and <link> tags into the specified
 * HTML and/or EJS files.
 *
 * NOTE: On Node.js >= 20, the bundled grunt-sails-linker has a Symbol bug.
 * Since the layout already has the correct script/link tags from a previous
 * build, we register these as no-op tasks. If you add new JS/CSS files,
 * add the references manually to views/layouts/layout.ejs.
 *
 */
module.exports = function(grunt) {

  grunt.registerTask('sails-linker:devJs', 'Link JS files (no-op)', function() {
    grunt.log.ok('Skipped sails-linker:devJs (layout already has script tags)');
  });

  grunt.registerTask('sails-linker:devStyles', 'Link CSS files (no-op)', function() {
    grunt.log.ok('Skipped sails-linker:devStyles (layout already has link tags)');
  });

  grunt.registerTask('sails-linker:devJsBuild', 'Link JS files for build (no-op)', function() {
    grunt.log.ok('Skipped sails-linker:devJsBuild');
  });

  grunt.registerTask('sails-linker:devStylesBuild', 'Link CSS files for build (no-op)', function() {
    grunt.log.ok('Skipped sails-linker:devStylesBuild');
  });

  grunt.registerTask('sails-linker:prodJs', 'Link JS files for prod (no-op)', function() {
    grunt.log.ok('Skipped sails-linker:prodJs');
  });

  grunt.registerTask('sails-linker:prodStyles', 'Link CSS files for prod (no-op)', function() {
    grunt.log.ok('Skipped sails-linker:prodStyles');
  });

  grunt.registerTask('sails-linker:prodJsBuild', 'Link JS files for prod build (no-op)', function() {
    grunt.log.ok('Skipped sails-linker:prodJsBuild');
  });

  grunt.registerTask('sails-linker:prodStylesBuild', 'Link CSS files for prod build (no-op)', function() {
    grunt.log.ok('Skipped sails-linker:prodStylesBuild');
  });

};
