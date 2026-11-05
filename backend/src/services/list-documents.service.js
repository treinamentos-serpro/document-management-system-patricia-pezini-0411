const repository = require('../repositories/documents.repository');
const { toPublicDocument } = require('./document.presenter');

function list(owner) {
  return repository.findByOwner(owner)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
    .map(toPublicDocument);
}

module.exports = { list };
