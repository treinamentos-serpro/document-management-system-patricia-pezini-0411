const path = require('node:path');

const maxFileSizeBytes = Number(process.env.MAX_FILE_SIZE_BYTES ?? 10485760);

if (!Number.isSafeInteger(maxFileSizeBytes) || maxFileSizeBytes <= 0) {
  throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo em bytes.');
}

if (process.env.STORAGE_DIR !== undefined && !process.env.STORAGE_DIR.trim()) {
  throw new Error('STORAGE_DIR deve indicar um diretório local.');
}

module.exports = {
  storageDir: path.resolve(__dirname, '../..', process.env.STORAGE_DIR ?? 'backend/storage'),
  maxFileSizeBytes,
};
