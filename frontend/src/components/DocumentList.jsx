import DownloadButton from './DownloadButton';

export default function DocumentList({ documents, userId, loading, error, onRetry }) {
  return (
    <section aria-labelledby="documents-title" aria-busy={loading}>
      <h2 id="documents-title">Meus documentos</h2>
      {loading ? (
        <p role="status">Carregando documentos...</p>
      ) : error ? (
        <>
          <p role="alert">{error}</p>
          <button type="button" onClick={onRetry}>Tentar novamente</button>
        </>
      ) : documents.length === 0 ? (
        <p>Nenhum documento enviado.</p>
      ) : (
        <ul>
          {documents.map((document) => (
            <li key={document.id}>
              <p>
                <strong>{document.originalName}</strong>
                {' — '}{document.size.toLocaleString('pt-BR')} bytes
                {' — '}{new Date(document.uploadedAt).toLocaleString('pt-BR')}
              </p>
              <DownloadButton document={document} userId={userId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
