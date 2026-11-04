# Document Management System com GitHub Copilot

<img src="https://octodex.github.com/images/Professortocat_v2.png" align="right" height="200px" />

Hey Pezini!

Mona here. I'm done preparing your exercise. Hope you enjoy! 💚

Remember, it's self-paced so feel free to take a break! ☕️

[![](https://img.shields.io/badge/Go%20to%20Exercise-%E2%86%92-1f883d?style=for-the-badge&logo=github&labelColor=197935)](https://github.com/treinamentos-serpro/document-management-system-patricia-pezini-0411/issues/1)

## Backend

```bash
cd backend
npm ci
npm start
# Em outro terminal, dentro de backend:
npm test
```

O backend usa rotas, controllers, services e repositories em `backend/src`.
Mantém os metadados em memória e grava os arquivos localmente com Multer
`diskStorage`. Reiniciar o processo perde os metadados, mas não apaga os arquivos.

Configuração por ambiente:

| Variável | Padrão |
| --- | --- |
| `PORT` | `3000` |
| `STORAGE_DIR` | `backend/storage` |
| `MAX_FILE_SIZE_BYTES` | `10485760` (10 MiB) |

O diretório padrão e caminhos relativos são resolvidos a partir da raiz do
repositório, independentemente do diretório de execução. O diretório é criado
no primeiro upload. O limite deve ser um inteiro positivo.

Todas as rotas de documentos exigem `X-User-Id` (1 a 128 caracteres após remover
espaços externos). Essa identificação é didática, **não é autenticação**.

```bash
curl -H 'X-User-Id: usuario-demo' -F 'file=@./documento.pdf' http://localhost:3000/upload
curl -H 'X-User-Id: usuario-demo' http://localhost:3000/documents
curl -H 'X-User-Id: usuario-demo' -OJ http://localhost:3000/documents/UUID/download
curl http://localhost:3000/health
```

Upload retorna `201` com `{ "document": { ... } }`; listagem retorna
`{ "documents": [...] }`, somente do dono informado e em ordem de envio
decrescente. Download retorna o arquivo como anexo. Os metadados públicos são
`id`, `originalName`, `size`, `uploadedAt` e `owner`, sem caminhos internos.

Erros usam `{ "error": { "code": "...", "message": "..." } }`: `400
INVALID_REQUEST`, `413 FILE_TOO_LARGE`, `404 DOCUMENT_NOT_FOUND` ou `500
STORAGE_ERROR`. Documentos de outro dono e arquivos indisponíveis retornam o
mesmo `404`. Veja os contratos completos na [especificação](docs/specs/dms-spec.md).

---

&copy; 2025 GitHub &bull; [Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/code_of_conduct.md) &bull; [MIT License](https://gh.io/mit)
