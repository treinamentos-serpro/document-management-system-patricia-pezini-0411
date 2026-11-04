const { randomUUID } = require('node:crypto');
const multer = require('multer');
const service = require('../services/documents.service');
const { maxFileSizeBytes } = require('../config');
const { createError } = require('../errors');

const receiveFile = multer({
  storage: multer.diskStorage({
    destination(req, file, callback) {
      service.prepareStorage().then(
        (directory) => callback(null, directory),
        (error) => callback(error),
      );
    },
    filename(req, file, callback) {
      callback(null, randomUUID());
    },
  }),
  // O parser dispara o limite ao atingi-lo; permitir exatamente o máximo configurado.
  limits: { fileSize: maxFileSizeBytes + 1, files: 1 },
}).single('file');

function validateUser(req, res, next) {
  const owner = req.get('X-User-Id')?.trim();
  if (!owner || owner.length > 128) {
    return next(createError('INVALID_REQUEST', 'Informe X-User-Id com 1 a 128 caracteres.'));
  }
  res.locals.owner = owner;
  next();
}

function receiveUpload(req, res, next) {
  receiveFile(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      return next(createError(
        error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'INVALID_REQUEST',
        error.code === 'LIMIT_FILE_SIZE'
          ? 'O arquivo excede o limite de tamanho permitido.'
          : 'Envie apenas um arquivo no campo file.',
      ));
    }
    if (/^(Multipart: Boundary not found|Unexpected end of (form|file)|Malformed part header)$/.test(error.message)) {
      return next(createError('INVALID_REQUEST', 'O formulário de upload é inválido.'));
    }
    next(error);
  });
}

async function upload(req, res) {
  const document = await service.upload(req.file, res.locals.owner);
  res.status(201).json({ document });
}

function list(req, res) {
  res.json({ documents: service.list(res.locals.owner) });
}

async function download(req, res, next) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.id)) {
    throw createError('INVALID_REQUEST', 'O identificador do documento é inválido.');
  }
  const document = await service.download(req.params.id, res.locals.owner);
  const safeName = document.originalName.replace(/[\x00-\x1f\x7f/\\]/g, '_');
  res.type(safeName);
  res.download(document.filePath, safeName, (error) => {
    if (error) next(error);
  });
}

function handleError(error, req, res, next) {
  if (res.headersSent) return next(error);

  let code = error.code;
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    code = req.method === 'GET' ? 'DOCUMENT_NOT_FOUND' : 'STORAGE_ERROR';
  }
  if (error.type === 'entity.parse.failed' || error instanceof URIError) {
    code = 'INVALID_REQUEST';
  }

  const responses = {
    INVALID_REQUEST: [400, 'A requisição é inválida.'],
    FILE_TOO_LARGE: [413, 'O arquivo excede o limite de tamanho permitido.'],
    DOCUMENT_NOT_FOUND: [404, 'Documento não encontrado.'],
    STORAGE_ERROR: [500, 'Não foi possível armazenar ou acessar o documento.'],
  };
  if (!Object.hasOwn(responses, code)) code = 'STORAGE_ERROR';
  const [status, message] = responses[code];
  if (status === 500) console.error('Falha no armazenamento de documentos:', error);
  res.status(status).type('json').json({
    error: {
      code,
      message: code === 'INVALID_REQUEST' && error.code === code ? error.message : message,
    },
  });
}

module.exports = { validateUser, receiveUpload, upload, list, download, handleError };
