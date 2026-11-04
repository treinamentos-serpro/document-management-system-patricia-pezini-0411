const { randomUUID } = require('node:crypto');
const repository = require('../repositories/documents.repository');
const { createError } = require('../errors');

function toPublicDocument({ id, originalName, size, uploadedAt, owner }) {
  return { id, originalName, size, uploadedAt, owner };
}

async function upload(file, owner) {
  if (!file) {
    throw createError('INVALID_REQUEST', 'Envie um arquivo no campo file.');
  }

  try {
    const document = repository.save({
      id: randomUUID(),
      originalName: file.originalname,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      owner,
      storedName: file.filename,
    });
    return toPublicDocument(document);
  } catch (error) {
    try {
      await repository.removeFile(file.filename);
    } catch (cleanupError) {
      console.error('Falha ao remover arquivo após erro no registro:', cleanupError);
    }
    throw error;
  }
}

function list(owner) {
  return repository.findByOwner(owner)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
    .map(toPublicDocument);
}

async function download(id, owner) {
  const document = repository.findById(id);
  if (!document || document.owner !== owner) {
    throw createError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }
  const filePath = await repository.getFilePath(document.storedName);
  return { filePath, originalName: document.originalName };
}

module.exports = { upload, list, download, prepareStorage: repository.prepareStorage };
