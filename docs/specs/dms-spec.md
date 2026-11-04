# Especificação - Document Management System

## 1. Objetivo

Entregar uma aplicação web simples para que usuários identificados no contexto
da aplicação possam enviar, listar e baixar seus documentos, mantendo os
arquivos no filesystem local e os metadados em memória.

## 2. Escopo

### Dentro do escopo

- Enviar um arquivo por requisição.
- Listar os documentos do usuário identificado na requisição.
- Baixar um documento do usuário pelo identificador.
- Exibir no frontend o formulário de upload, a lista de documentos e uma ação de
  download.
- Informar sucesso e erros de entrada, rede e servidor em português.
- Tratar o identificador de usuário enviado pelo cliente como uma identificação
  didática, sem autenticação.

### Fora do escopo

- Autenticação, autorização real, cadastro ou administração de usuários.
- Armazenamento externo, em nuvem ou em banco de dados.
- Persistência dos metadados entre reinicializações do processo.
- Versionamento, edição, exclusão, compartilhamento ou busca de documentos.
- Restrições de tipo de arquivo por extensão ou conteúdo.
- Garantia de consistência ou compartilhamento de estado entre múltiplas
  instâncias do backend.

## 3. Requisitos funcionais

| ID    | Requisito |
| ----- | --------- |
| RF-01 | O usuário pode enviar um único arquivo usando `multipart/form-data`, no campo `file`. |
| RF-02 | O sistema valida que o arquivo e o identificador do usuário foram fornecidos. |
| RF-03 | O sistema grava o conteúdo do arquivo no filesystem local usando Multer com `diskStorage`, sob `backend/storage` por padrão. |
| RF-04 | O sistema cria metadados para o arquivo e os mantém em memória durante a vida do processo. |
| RF-05 | O usuário pode listar somente os documentos associados ao identificador enviado na requisição. |
| RF-06 | O usuário pode baixar, pelo identificador, um documento associado ao identificador enviado na requisição. |
| RF-07 | O sistema não revela nem permite baixar um documento sem correspondência de dono; documento inexistente ou de outro dono retorna o mesmo erro. |
| RF-08 | O frontend permite selecionar e enviar um arquivo, visualizar a lista retornada e iniciar o download de um documento. |
| RF-09 | O frontend apresenta mensagens compreensíveis para erros de validação, rede e resposta do servidor. |
| RF-10 | O endpoint de saúde existente `GET /health` continua disponível e retorna estado saudável do processo. |

### Identificação do usuário

As requisições de upload, listagem e download usam o header `X-User-Id`. Na
primeira versão, o frontend o obtém de `VITE_USER_ID` e o envia em cada chamada.
O valor deve ser uma string não vazia após remoção de espaços e ter no máximo
128 caracteres. A ausência ou invalidade do identificador resulta em `400 Bad
Request`.

Esse valor é fornecido pelo próprio cliente e não é autenticado. O filtro por
dono organiza os dados para o exercício, mas não constitui controle de acesso:
qualquer cliente pode declarar outro `X-User-Id`. Não armazenar credenciais nem
apresentar esse mecanismo como seguro para produção.

## 4. Requisitos não funcionais

| ID     | Requisito |
| ------ | --------- |
| RNF-01 | Arquivos são armazenados somente no filesystem local por Multer `diskStorage`; não integrar serviços externos de arquivos. |
| RNF-02 | Metadados são mantidos em memória nesta fase e podem ser perdidos ao reiniciar o processo. |
| RNF-03 | Configuração de execução é feita por variáveis de ambiente, com valores padrão documentados. |
| RNF-04 | Aplicar limite configurável de tamanho do upload para evitar consumo ilimitado de disco e memória. O padrão inicial é 10 MiB (`10485760` bytes). |
| RNF-05 | O nome original do arquivo nunca é usado como caminho de armazenamento; usar um nome interno gerado pelo servidor. |
| RNF-06 | O caminho local e o nome interno de armazenamento não são enviados ao cliente. |
| RNF-07 | O backend é organizado em `routes/`, `controllers/`, `services/` e `repositories/`, com dependências no sentido routes → controllers → services → repositories. |
| RNF-08 | O frontend usa React funcional com Hooks e chama a API por `fetch` através do prefixo `/api`, atendido pelo proxy do Vite. |
| RNF-09 | As mensagens apresentadas ao usuário e os comentários escritos no código são em português; nomes de símbolos são em inglês. |
| RNF-10 | Tratar erros de leitura e gravação do filesystem explicitamente; não responder sucesso se a persistência do arquivo ou o registro do metadado falhar. |

## 5. Modelo de dados

### Metadados internos do documento

| Campo | Tipo | Obrigatório | Descrição |
| ----- | ---- | ----------- | --------- |
| `id` | string | Sim | Identificador único gerado pelo servidor, preferencialmente UUID. |
| `originalName` | string | Sim | Nome original fornecido no upload; usado como nome sugerido no download, nunca como caminho. |
| `size` | number | Sim | Tamanho do arquivo em bytes. |
| `uploadedAt` | string | Sim | Instante do recebimento, em ISO 8601 UTC. |
| `owner` | string | Sim | Valor validado de `X-User-Id`. |
| `storedName` | string | Sim | Nome interno, gerado pelo servidor, relativo à pasta de armazenamento. Campo privado do backend. |

O repositório mantém os registros em memória, indexados por `id`. O caminho
absoluto do arquivo pode ser derivado de `STORAGE_DIR` e `storedName`; não
precisa ser exposto nem fazer parte do objeto público.

### Representação pública

As respostas de upload e listagem expõem somente `id`, `originalName`, `size`,
`uploadedAt` e `owner`. Não expõem `storedName`, caminho absoluto, conteúdo ou
detalhes internos do filesystem.

Reiniciar o processo limpa o repositório de metadados. Arquivos já gravados
podem continuar no disco, mas não serão listáveis ou baixáveis sem metadados em
memória. A limpeza de arquivos órfãos não faz parte desta versão.

## 6. Contratos de API

Os caminhos abaixo são os caminhos do backend. O frontend os acessa com o
prefixo `/api` configurado no proxy do Vite. Requisições de upload e listagem
devem incluir `X-User-Id`; download também o inclui para verificar o dono.

### Formato comum de erro

Erros da API retornam JSON no formato:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Descrição compreensível do erro."
  }
}
```

O campo `code` é estável para uso pelo frontend; `message` é uma mensagem
adequada ao usuário e não inclui stack trace, caminhos locais nem detalhes
internos.

### `POST /upload`

- **Objetivo:** armazenar um documento e registrar seus metadados.
- **Headers:** `X-User-Id: <identificador>` e
  `Content-Type: multipart/form-data`.
- **Entrada:** um arquivo no campo `file`; não aceitar múltiplos arquivos.
- **Sucesso:** `201 Created`, `Content-Type: application/json`.

```json
{
  "document": {
    "id": "8b4e3a8b-9a7f-4e31-b35f-0d36140759a1",
    "originalName": "relatorio.pdf",
    "size": 15360,
    "uploadedAt": "2026-11-04T19:14:30.000Z",
    "owner": "usuario-demo"
  }
}
```

- **Erros:**
  - `400 INVALID_REQUEST`: `X-User-Id` ausente ou inválido, arquivo ausente,
    campo incorreto ou mais de um arquivo.
  - `413 FILE_TOO_LARGE`: arquivo acima do limite configurado.
  - `500 STORAGE_ERROR`: erro ao gravar arquivo ou registrar metadados; não
    retornar metadados de sucesso. Remover o arquivo parcial quando possível.

### `GET /documents`

- **Objetivo:** listar os documentos cujo `owner` corresponde a `X-User-Id`.
- **Headers:** `X-User-Id: <identificador>`.
- **Sucesso:** `200 OK`, lista ordenada de `uploadedAt` mais recente para mais
  antigo. Sem resultados, retornar lista vazia.

```json
{
  "documents": [
    {
      "id": "8b4e3a8b-9a7f-4e31-b35f-0d36140759a1",
      "originalName": "relatorio.pdf",
      "size": 15360,
      "uploadedAt": "2026-11-04T19:14:30.000Z",
      "owner": "usuario-demo"
    }
  ]
}
```

- **Erro:** `400 INVALID_REQUEST` quando o header está ausente ou inválido.

### `GET /documents/:id/download`

- **Objetivo:** transmitir o conteúdo do documento como anexo.
- **Headers:** `X-User-Id: <identificador>`.
- **Sucesso:** `200 OK`, corpo binário do arquivo, `Content-Disposition:
  attachment` com o nome original devidamente sanitizado e `Content-Type`
  apropriado ou `application/octet-stream` quando desconhecido.
- **Erros:**
  - `400 INVALID_REQUEST`: `X-User-Id` ausente ou inválido, ou identificador
    malformado.
  - `404 DOCUMENT_NOT_FOUND`: documento inexistente, de outro dono ou arquivo
    indisponível no filesystem. Usar a mesma resposta para não revelar a
    existência de documentos de outro dono.
  - `500 STORAGE_ERROR`: falha de leitura não equivalente a arquivo inexistente.

O serviço deve conferir dono e metadados antes de acessar o caminho interno.
Resolver o caminho exclusivamente a partir do `storedName` gerado pelo servidor
e da pasta local configurada; nunca aceitar um caminho fornecido pelo cliente.

### `GET /health`

- **Objetivo:** verificar que o processo do backend está respondendo.
- **Sucesso:** `200 OK`, `{"status":"ok"}`. Não expõe configuração, caminho de
  armazenamento nem dados dos documentos.

## 7. Decisões arquiteturais

### Backend

- `routes/`: registra `POST /upload`, `GET /documents`,
  `GET /documents/:id/download` e delega aos controllers.
- `controllers/`: lê headers, parâmetros e arquivo recebido; valida a forma da
  requisição; converte resultado ou erro da aplicação em status e resposta
  HTTP.
- `services/`: concentra as regras de negócio, incluindo associação ao dono,
  limite e comportamento de upload, filtro de listagem e verificação de dono no
  download.
- `repositories/`: mantém metadados em memória e resolve operações do
  filesystem local. Multer `diskStorage` grava exclusivamente na pasta local,
  `backend/storage` por padrão.
- O fluxo de dependência é routes → controllers → services → repositories.
  Services e repositories não dependem de Express nem de objetos de resposta
  HTTP.
- O backend permanece em Node.js, Express e CommonJS, usando JavaScript sem
  TypeScript. Reutilizar dependências disponíveis no projeto.

### Frontend

- Usar componentes funcionais com React Hooks, organizados em `components/`,
  `pages/` e `services/`.
- A camada de serviço usa `fetch` em `/api/upload`, `/api/documents` e
  `/api/documents/:id/download`, enviando `X-User-Id` em cada operação.
- `VITE_USER_ID` configura o identificador usado pelo frontend demonstrativo;
  se ausente ou vazio, a interface deve explicar que a configuração está
  faltando e não enviar requisições sem identidade.
- Para upload, enviar `FormData` com o campo `file` e deixar o navegador definir
  o `Content-Type` multipart e seu boundary.
- Para download, tratar o corpo como binário e usar o nome retornado nos
  metadados como nome sugerido, sem interpretar caminhos do servidor.
- O backend retorna JSON para listagem/upload e conteúdo binário para download;
  a interface deve tratar esses formatos de resposta separadamente.

### Configuração

| Variável | Padrão | Uso |
| -------- | ------ | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `STORAGE_DIR` | `backend/storage` | Diretório local para gravação. O padrão e valores relativos são resolvidos a partir da raiz do repositório, independentemente do diretório de trabalho do processo. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Limite por arquivo (10 MiB), aplicado pelo middleware de upload. |
| `VITE_USER_ID` | Sem padrão | Identificador didático enviado pelo frontend em `X-User-Id`. |

Valores de configuração inválidos devem ser reportados explicitamente na
inicialização ou no limite da requisição; não substituir silenciosamente por
valores não documentados.

## 8. Plano de execução

As etapas abaixo descrevem trabalho futuro. Esta especificação não executa nem
inclui alterações nos arquivos de implementação do backend ou do frontend.

1. **Preparar configuração e armazenamento local:** definir configuração por
   ambiente, diretório `backend/storage`, limite de upload e nome interno seguro
   para arquivos.
2. **Implementar persistência:** criar repositório de metadados em memória e
   operações locais de gravação e leitura, sem dependência de Express.
3. **Implementar regras de negócio:** adicionar validação de arquivo, associação
   ao dono, listagem filtrada e política de download por dono.
4. **Implementar API:** criar controllers e routes para upload, listagem e
   download; mapear erros para os contratos e preservar `GET /health`.
5. **Testar backend:** cobrir contratos, casos inválidos, isolamento lógico por
   dono, limite de arquivo, erros do filesystem e execução com `node --test`.
6. **Implementar consumo no frontend:** criar serviço com `fetch` e
   `X-User-Id`, formulário de upload, listagem, ação de download e estados de
   carregamento/erro.
7. **Validar integração:** executar o frontend e backend, confirmar o proxy
   `/api`, verificar upload → listagem → download, testar identificadores
   distintos e conferir que nenhum caminho interno é exposto.
