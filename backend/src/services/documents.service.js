const repository = require('../repositories/documents.repository');
const { upload } = require('./upload-document.service');
const { list } = require('./list-documents.service');
const { download } = require('./download-document.service');

module.exports = { upload, list, download, prepareStorage: repository.prepareStorage };
