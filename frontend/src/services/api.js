async function request(path, userId, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { ...options.headers, 'X-User-Id': userId },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Não foi possível conectar ao servidor.', { cause: error });
  }

  if (!response.ok) {
    let message = `Não foi possível concluir a operação (HTTP ${response.status}).`;
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.json();
      message = body.error?.message || message;
    }
    throw new Error(message);
  }

  return response;
}

export async function listDocuments(userId, { signal } = {}) {
  const response = await request('/documents', userId, { signal });
  const { documents } = await response.json();
  return documents;
}

export async function uploadDocument(file, userId) {
  const body = new FormData();
  body.append('file', file);
  const response = await request('/upload', userId, { method: 'POST', body });
  const { document } = await response.json();
  return document;
}

export async function downloadDocument(id, userId) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`, userId);
  return response.blob();
}
