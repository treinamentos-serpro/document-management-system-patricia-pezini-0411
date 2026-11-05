const repository = require('../repositories/documents.repository');
const { createError } = require('../errors');

async function download(id, owner) {
  const document = repository.findById(id);
  if (!document || document.owner !== owner) {
    throw createError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }
  const filePath = await repository.getFilePath(document.storedName);
  return { filePath, originalName: document.originalName };
}

module.exports = { download };
