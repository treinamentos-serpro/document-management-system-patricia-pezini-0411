import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadDocument, listDocuments, uploadDocument } from './api.js';

test('lista documentos usando o prefixo /api, usuário e cancelamento', async (t) => {
  const documents = [{ id: 'document-id', originalName: 'relatorio.pdf' }];
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/documents');
    assert.equal(options.headers['X-User-Id'], 'usuario');
    assert.equal(options.signal, controller.signal);
    return Response.json({ documents });
  });

  assert.deepEqual(await listDocuments('usuario', { signal: controller.signal }), documents);
});

test('envia um arquivo multipart sem sobrescrever o Content-Type', async (t) => {
  const file = new File(['conteudo'], 'relatorio.txt');
  const document = { id: 'document-id', originalName: file.name };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/upload');
    assert.equal(options.method, 'POST');
    assert.deepEqual(options.headers, { 'X-User-Id': 'usuario' });
    assert.equal(options.body.get('file'), file);
    return Response.json({ document }, { status: 201 });
  });

  assert.deepEqual(await uploadDocument(file, 'usuario'), document);
});

test('baixa os bytes do documento com identificação do usuário', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/documents/document%2Fid/download');
    assert.equal(options.headers['X-User-Id'], 'usuario');
    return new Response(new Uint8Array([0, 1, 255]));
  });

  const blob = await downloadDocument('document/id', 'usuario');
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new Uint8Array([0, 1, 255]));
});

test('propaga a mensagem de erro do backend para todas as operações', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    error: { code: 'DOCUMENT_NOT_FOUND', message: 'Documento não encontrado.' },
  }, { status: 404 }));

  for (const operation of [
    () => listDocuments('usuario'),
    () => uploadDocument(new File(['x'], 'arquivo.txt'), 'usuario'),
    () => downloadDocument('id', 'usuario'),
  ]) {
    await assert.rejects(operation, /Documento não encontrado\./);
  }
});

test('informa falhas HTTP sem resposta JSON', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('Bad Gateway', { status: 502 }));
  await assert.rejects(() => listDocuments('usuario'), /HTTP 502/);
});

test('informa falhas de conexão', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(() => listDocuments('usuario'), /Não foi possível conectar ao servidor/);
});

test('preserva o cancelamento da requisição', async (t) => {
  const error = new DOMException('Cancelado', 'AbortError');
  t.mock.method(globalThis, 'fetch', async () => { throw error; });
  await assert.rejects(() => listDocuments('usuario'), (received) => received === error);
});
