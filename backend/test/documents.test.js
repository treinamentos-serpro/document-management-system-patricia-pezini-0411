const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { mkdtempSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');

const temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), 'dms-test-'));
process.env.STORAGE_DIR = path.join(temporaryDirectory, 'storage');
process.env.MAX_FILE_SIZE_BYTES = '32';

const app = require('../src/app');
const repository = require('../src/repositories/documents.repository');
const storageDir = process.env.STORAGE_DIR;
let server;
let baseUrl;

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

function request(route, options = {}, owner = 'alice') {
  const headers = { ...options.headers };
  if (owner !== null) headers['X-User-Id'] = owner;
  return fetch(`${baseUrl}${route}`, { ...options, headers });
}

function upload(content = 'conteudo do documento', name = 'documento.txt', owner = 'alice') {
  const body = new FormData();
  body.append('file', new Blob([content]), name);
  return request('/upload', { method: 'POST', body }, owner);
}

async function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('content-type'), /application\/json/);
  const result = await response.json();
  assert.deepEqual(Object.keys(result), ['error']);
  assert.deepEqual(Object.keys(result.error).sort(), ['code', 'message']);
  assert.equal(result.error.code, code);
  assert.equal(typeof result.error.message, 'string');
  assert.ok(result.error.message.length > 0);
  assert.ok(!result.error.message.includes(temporaryDirectory));
  return result;
}

test('contratos HTTP de documentos com armazenamento local', async (t) => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  let document;
  let storedName;

  await t.test('preserva o endpoint de saúde', async () => {
    const response = await request('/health', {}, null);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });

  await t.test('inicia com lista vazia', async () => {
    const response = await request('/documents');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { documents: [] });
  });

  await t.test('valida o usuário antes de gravar o upload', async () => {
    for (const owner of [null, '   ', 'x'.repeat(129)]) {
      await assertError(await upload('texto', 'a.txt', owner), 400, 'INVALID_REQUEST');
      await assertError(await request('/documents', {}, owner), 400, 'INVALID_REQUEST');
      await assertError(
        await request(`/documents/${randomUUID()}/download`, {}, owner),
        400,
        'INVALID_REQUEST',
      );
    }
    await assert.rejects(fs.stat(storageDir), { code: 'ENOENT' });
  });

  await t.test('grava em disco e retorna somente os metadados públicos', async () => {
    const response = await upload(undefined, undefined, ' alice ');
    assert.equal(response.status, 201);
    const result = await response.json();
    assert.deepEqual(Object.keys(result), ['document']);
    document = result.document;
    assert.deepEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    assert.match(document.id, /^[0-9a-f-]{36}$/);
    assert.equal(document.originalName, 'documento.txt');
    assert.equal(document.size, Buffer.byteLength('conteudo do documento'));
    assert.equal(document.owner, 'alice');
    assert.equal(new Date(document.uploadedAt).toISOString(), document.uploadedAt);
    const files = await fs.readdir(storageDir);
    assert.equal(files.length, 1);
    storedName = files[0];
    assert.notEqual(storedName, document.originalName);
    assert.equal(await fs.readFile(path.join(storageDir, storedName), 'utf8'), 'conteudo do documento');
  });

  await t.test('filtra por dono e ordena do mais recente para o mais antigo', async () => {
    const second = (await (await upload('segundo', 'segundo.txt')).json()).document;
    await upload('outro usuario', 'bob.txt', 'bob');
    const result = await (await request('/documents')).json();
    assert.deepEqual(result.documents, [second, document]);
    const bob = await (await request('/documents', {}, 'bob')).json();
    assert.equal(bob.documents.length, 1);
    assert.equal(bob.documents[0].owner, 'bob');
  });

  await t.test('baixa o conteúdo original como anexo', async () => {
    const response = await request(`/documents/${document.id}/download`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /attachment; filename="documento.txt"/);
    assert.match(response.headers.get('content-type'), /text\/plain/);
    assert.equal(await response.text(), 'conteudo do documento');
  });

  await t.test('usa a mesma resposta para documento inexistente e de outro dono', async () => {
    const otherOwner = await assertError(
      await request(`/documents/${document.id}/download`, {}, 'bob'),
      404,
      'DOCUMENT_NOT_FOUND',
    );
    const missing = await assertError(
      await request(`/documents/${randomUUID()}/download`),
      404,
      'DOCUMENT_NOT_FOUND',
    );
    assert.deepEqual(otherOwner, missing);
  });

  await t.test('rejeita identificador malformado', async () => {
    await assertError(await request('/documents/invalido/download'), 400, 'INVALID_REQUEST');
    await assertError(await request('/documents/%E0%A4%A/download'), 400, 'INVALID_REQUEST');
  });

  await t.test('rejeita ausência de arquivo e multipart malformado', async () => {
    await assertError(await request('/upload', { method: 'POST' }), 400, 'INVALID_REQUEST');
    await assertError(await request('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: 'invalido',
    }), 400, 'INVALID_REQUEST');
    const before = await fs.readdir(storageDir);
    await assertError(await request('/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=dms-boundary' },
      body: '--dms-boundary\r\nContent-Disposition: form-data; name="file"; filename="a.txt"\r\n'
        + 'Content-Type: text/plain\r\n\r\nincompleto',
    }), 400, 'INVALID_REQUEST');
    assert.deepEqual(await fs.readdir(storageDir), before);
  });

  await t.test('rejeita campo incorreto e múltiplos arquivos sem deixar arquivos órfãos', async () => {
    const before = await fs.readdir(storageDir);
    for (const fields of [['other'], ['file', 'file']]) {
      const body = new FormData();
      for (const field of fields) body.append(field, new Blob(['texto']), 'arquivo.txt');
      await assertError(await request('/upload', { method: 'POST', body }), 400, 'INVALID_REQUEST');
    }
    assert.deepEqual(await fs.readdir(storageDir), before);
  });

  await t.test('aceita exatamente o limite e remove uploads acima dele', async () => {
    const response = await upload('x'.repeat(32), 'limite.bin');
    assert.equal(response.status, 201);
    assert.equal((await response.json()).document.size, 32);
    const before = await fs.readdir(storageDir);
    await assertError(await upload('x'.repeat(33)), 413, 'FILE_TOO_LARGE');
    assert.deepEqual(await fs.readdir(storageDir), before);
  });

  await t.test('preserva conteúdo binário e nomes internos independentes do nome original', async () => {
    const content = Buffer.from([0, 255, 128, 13, 10, 0]);
    const response = await upload(content, '../arquivo.bin');
    assert.equal(response.status, 201);
    const uploaded = (await response.json()).document;
    assert.equal(uploaded.originalName, 'arquivo.bin');
    const downloaded = await request(`/documents/${uploaded.id}/download`);
    assert.equal(downloaded.status, 200);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), content);
  });

  await t.test('aceita arquivo vazio e nomes repetidos sem sobrescrever arquivos', async () => {
    const first = (await (await upload('', 'repetido.txt')).json()).document;
    const second = (await (await upload('outro', 'repetido.txt')).json()).document;
    assert.notEqual(first.id, second.id);
    assert.equal(first.size, 0);
    const empty = await request(`/documents/${first.id}/download`);
    assert.equal(empty.status, 200);
    assert.equal(await empty.text(), '');
    const other = await request(`/documents/${second.id}/download`);
    assert.equal(await other.text(), 'outro');
  });

  await t.test('arquivo removido retorna 404', async () => {
    await fs.unlink(path.join(storageDir, storedName));
    await assertError(
      await request(`/documents/${document.id}/download`),
      404,
      'DOCUMENT_NOT_FOUND',
    );
  });

  await t.test('falha no registro remove o arquivo e não publica metadados', async (t) => {
    const beforeFiles = await fs.readdir(storageDir);
    const beforeList = await (await request('/documents')).json();
    t.mock.method(repository, 'save', () => { throw new Error('Falha simulada no registro'); });
    const log = t.mock.method(console, 'error', () => {});
    await assertError(await upload('falha'), 500, 'STORAGE_ERROR');
    assert.equal(log.mock.callCount(), 1);
    assert.deepEqual(await fs.readdir(storageDir), beforeFiles);
    assert.deepEqual(await (await request('/documents')).json(), beforeList);
  });

  await t.test('falha de leitura retorna erro de armazenamento sem detalhes internos', async (t) => {
    const current = (await (await request('/documents')).json()).documents[0];
    t.mock.method(repository, 'getFilePath', async () => {
      throw Object.assign(new Error('Falha de leitura'), { code: 'EACCES' });
    });
    const log = t.mock.method(console, 'error', () => {});
    await assertError(await request(`/documents/${current.id}/download`), 500, 'STORAGE_ERROR');
    assert.equal(log.mock.callCount(), 1);
  });

  await t.test('falha real no diretório de armazenamento não registra metadados', async (t) => {
    const backup = path.join(temporaryDirectory, 'backup');
    const beforeList = await (await request('/documents')).json();
    const log = t.mock.method(console, 'error', () => {});
    await fs.rename(storageDir, backup);
    try {
      await fs.writeFile(storageDir, 'não é um diretório');
      await assertError(await upload('falha'), 500, 'STORAGE_ERROR');
      assert.equal(log.mock.callCount(), 1);
      assert.deepEqual(await (await request('/documents')).json(), beforeList);
    } finally {
      await fs.unlink(storageDir);
      await fs.rename(backup, storageDir);
    }
  });
});

test('configuração local é estável e rejeita valores inválidos', () => {
  const configPath = path.resolve(__dirname, '../src/config.js');
  const runConfig = (environment) => spawnSync(process.execPath, [
    '-e', 'console.log(JSON.stringify(require(process.argv[1])))', configPath,
  ], {
    cwd: os.tmpdir(),
    encoding: 'utf8',
    env: environment,
  });
  const environment = { ...process.env };
  delete environment.STORAGE_DIR;
  delete environment.MAX_FILE_SIZE_BYTES;
  const result = runConfig(environment);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    storageDir: path.resolve(__dirname, '../storage'),
    maxFileSizeBytes: 10485760,
  });
  const relative = runConfig({ ...environment, STORAGE_DIR: 'backend/custom-storage' });
  assert.equal(relative.status, 0, relative.stderr);
  assert.equal(JSON.parse(relative.stdout).storageDir, path.resolve(__dirname, '../custom-storage'));
  for (const value of ['0', '-1', 'abc', '1.5', '', '9007199254740992']) {
    const invalid = runConfig({ ...environment, MAX_FILE_SIZE_BYTES: value });
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /MAX_FILE_SIZE_BYTES/);
  }
  const invalidDirectory = runConfig({ ...environment, STORAGE_DIR: ' ' });
  assert.notEqual(invalidDirectory.status, 0);
  assert.match(invalidDirectory.stderr, /STORAGE_DIR/);
});
