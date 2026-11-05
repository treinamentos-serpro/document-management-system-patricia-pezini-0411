const { randomUUID } = require('node:crypto');
const repository = require('../repositories/documents.repository');
const { createError } = require('../errors');
const { toPublicDocument } = require('./document.presenter');

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

module.exports = { upload };
