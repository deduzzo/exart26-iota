
module.exports['swagger-generator'] = {
  disabled: false,
  swaggerJsonPath: './swagger/swagger.json',
  swagger: {
    openapi: '3.0.0',
    info: {
      title: 'Swagger Json',
      description: 'This is a generated swagger json for your sails project',
      termsOfService: 'http://example.com/terms',
      contact: {name: 'Theophilus Omoregbee', url: 'http://github.com/theo4u', email: 'theo4u@ymail.com'},
      license: {name: 'Apache 2.0', url: 'http://www.apache.org/licenses/LICENSE-2.0.html'},
      version: '1.0.0'
    },
    servers: [
      { url: process.env.BASE_URL || 'http://localhost:1337' }
    ],
    externalDocs: {url: 'https://theoomoregbee.github.io/'}
  },
};
