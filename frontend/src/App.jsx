import { useEffect, useState } from 'react';
import UploadComponent from './components/UploadComponent';
import DocumentList from './components/DocumentList';
import { listDocuments } from './services/api';

function DocumentsPanel({ userId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);

  function refreshDocuments() {
    setRevision((value) => value + 1);
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    listDocuments(userId, { signal: controller.signal })
      .then((documents) => {
        if (!controller.signal.aborted) setDocuments(documents);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [userId, revision]);

  return (
    <>
      <UploadComponent userId={userId} onUploaded={refreshDocuments} />
      <DocumentList
        documents={documents}
        userId={userId}
        loading={loading}
        error={error}
        onRetry={refreshDocuments}
      />
    </>
  );
}

export default function App() {
  const [userId, setUserId] = useState('');
  const [userInput, setUserInput] = useState('');
  const [error, setError] = useState('');

  function handleUserSubmit(event) {
    event.preventDefault();
    const owner = userInput.trim();
    if (!owner || owner.length > 128) {
      setError('Informe um usuário com 1 a 128 caracteres.');
      return;
    }
    setError('');
    setUserId(owner);
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Document Management System</h1>
      <p>A identificação de usuário é didática e não substitui autenticação.</p>
      <form onSubmit={handleUserSubmit}>
        <label htmlFor="user-id">Usuário </label>
        <input
          id="user-id"
          value={userInput}
          onChange={(event) => setUserInput(event.target.value)}
          required
          maxLength={128}
        />
        <button type="submit">Carregar documentos</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {userId && (
        <>
          <p>Documentos de: <strong>{userId}</strong></p>
          <DocumentsPanel key={userId} userId={userId} />
        </>
      )}
    </main>
  );
}
