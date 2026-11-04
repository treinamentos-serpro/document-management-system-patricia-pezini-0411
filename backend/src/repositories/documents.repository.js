const fs = require('node:fs/promises');
const path = require('node:path');
const { storageDir } = require('../config');
const { createError } = require('../errors');

const documents = new Map();

async function prepareStorage() {
  await fs.mkdir(storageDir, { recursive: true });
  return storageDir;
}

function save(document) {
  documents.set(document.id, document);
  return document;
}

function findByOwner(owner) {
  return [...documents.values()].filter((document) => document.owner === owner);
}

function findById(id) {
  return documents.get(id);
}

function removeFile(storedName) {
  return fs.unlink(path.join(storageDir, storedName));
}

async function getFilePath(storedName) {
  const filePath = path.join(storageDir, storedName);
  const stats = await fs.stat(filePath);
  if (!stats.isFile()) {
    throw createError('DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
  }
  return filePath;
}

module.exports = { prepareStorage, save, findByOwner, findById, removeFile, getFilePath };
