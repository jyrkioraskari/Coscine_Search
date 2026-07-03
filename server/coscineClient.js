const COSCINE_API_BASE = 'https://coscine.rwth-aachen.de/coscine/api/v2';

export async function scanCoscine({ apiKey }) {
  const client = createCoscineClient(apiKey);
  const projects = await fetchProjects(client);
  const resourcesByProject = await Promise.all(
    projects.map(async (project) => {
      const resources = await fetchProjectResources(client, project.id);

      return Promise.all(
        resources.map(async (resource) => {
          return {
            projectId: project.id,
            projectName: project.displayName || project.name || project.slug || project.id,
            resourceId: resource.id,
            resourceName: resource.displayName || resource.name || resource.id,
            resourceType: resource.type?.displayName || resource.type?.name || '',
            applicationProfileUri: resource.applicationProfile?.uri || '',
            rawProject: project,
            rawResource: resource,
          };
        }),
      );
    }),
  );

  return {
    apiBaseUrl: COSCINE_API_BASE,
    projects: projects.length,
    resources: resourcesByProject.flat(),
    scannedAt: new Date().toISOString(),
  };
}

export async function fetchCoscineResourceDetails({ apiKey, projectId, resourceId }) {
  if (!projectId || !resourceId) {
    throw new Error('Project ID and resource ID are required.');
  }

  const client = createCoscineClient(apiKey);
  const files = await fetchResourceFiles(client, projectId, resourceId);

  return {
    files,
    loadedAt: new Date().toISOString(),
  };
}

export async function fetchCoscineApplicationProfile({ apiKey, profileUri }) {
  const normalizedProfileUri = String(profileUri ?? '').trim();

  if (!normalizedProfileUri) {
    throw new Error('Selected Coscine resource has no application profile URI.');
  }

  const client = createCoscineClient(apiKey);
  const encodedProfileUri = encodeURIComponent(normalizedProfileUri);
  const shapes = await client.get(`/application-profiles/profiles/${encodedProfileUri}/raw`, {
    headers: { Accept: 'text/turtle' },
  });

  if (!String(shapes ?? '').trim()) {
    throw new Error(`Coscine returned an empty profile definition for ${normalizedProfileUri}.`);
  }

  return {
    baseUri: normalizedProfileUri,
    name: normalizedProfileUri,
    shapes,
  };
}

export async function fetchCoscineFileContent({ apiKey, projectId, resourceId, path }) {
  if (!projectId || !resourceId || !path) {
    throw new Error('Project ID, resource ID, and file path are required.');
  }

  const authorization = buildAuthorizationHeader(apiKey);
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedResourceId = encodeURIComponent(resourceId);
  const encodedPath = encodeCoscinePath(path);
  const response = await fetch(
    `${COSCINE_API_BASE}/projects/${encodedProjectId}/resources/${encodedResourceId}/storage/${encodedPath}/content`,
    {
      headers: {
        Authorization: authorization,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return response;
}

function createCoscineClient(apiKey) {
  const authorization = buildAuthorizationHeader(apiKey);

  return {
    async get(path, options = {}) {
      const response = await fetch(`${COSCINE_API_BASE}${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          Authorization: authorization,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }

      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type') ?? '';
      return contentType.includes('application/json') ? response.json() : response.text();
    },
  };
}

function buildAuthorizationHeader(apiKey) {
  const trimmedKey = String(apiKey ?? '').trim();

  if (!trimmedKey) {
    throw new Error('Enter a Coscine API key first.');
  }

  return trimmedKey.toLowerCase().startsWith('bearer ') ? trimmedKey : `Bearer ${trimmedKey}`;
}

async function fetchProjects(client) {
  const payload = await client.get('/projects?PageNumber=1&PageSize=100&OrderBy=name%20asc');
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function fetchProjectResources(client, projectId) {
  const encodedProjectId = encodeURIComponent(projectId);
  const payload = await client.get(
    `/projects/${encodedProjectId}/resources?PageNumber=1&PageSize=100&OrderBy=name%20asc`,
  );

  return Array.isArray(payload?.data) ? payload.data : [];
}

async function fetchResourceFiles(client, projectId, resourceId) {
  const rootEntries = await fetchStorageEntries(client, projectId, resourceId, '');
  const files = [];
  const folders = [...rootEntries];
  const seenFolders = new Set();

  while (folders.length > 0) {
    const entry = folders.shift();
    const path = getEntryPath(entry);

    if (!path || seenFolders.has(path)) {
      continue;
    }

    if (isDirectoryEntry(entry)) {
      seenFolders.add(path);
      const children = await fetchStorageEntries(client, projectId, resourceId, path).catch(() => []);
      folders.push(...children);
      continue;
    }

    files.push(await withMetadata(client, projectId, resourceId, entry, path));
  }

  const rootFiles = await Promise.all(
    rootEntries
      .filter((entry) => !isDirectoryEntry(entry))
      .map((entry) => withMetadata(client, projectId, resourceId, entry, getEntryPath(entry))),
  );

  return dedupeFiles([...rootFiles, ...files]);
}

async function fetchStorageEntries(client, projectId, resourceId, path) {
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedResourceId = encodeURIComponent(resourceId);
  const encodedPath = encodeCoscinePath(path);
  const candidates = encodedPath
    ? [
        `/projects/${encodedProjectId}/resources/${encodedResourceId}/storage/${encodedPath}`,
        `/projects/${encodedProjectId}/resources/${encodedResourceId}/storage?Path=${encodeURIComponent(path)}`,
      ]
    : [
        `/projects/${encodedProjectId}/resources/${encodedResourceId}/storage`,
        `/projects/${encodedProjectId}/resources/${encodedResourceId}/storage?Path=/`,
      ];

  for (const candidate of candidates) {
    try {
      return normalizeCollection(await client.get(candidate));
    } catch {
      // Try the next route shape. Coscine storage route behavior can vary by resource type.
    }
  }

  return [];
}

async function withMetadata(client, projectId, resourceId, entry, path) {
  return {
    ...entry,
    path,
    metadata: await fetchFileMetadata(client, projectId, resourceId, path),
  };
}

async function fetchFileMetadata(client, projectId, resourceId, path) {
  if (!path) {
    return null;
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const encodedResourceId = encodeURIComponent(resourceId);
  const encodedPath = encodeCoscinePath(path);

  try {
    return await client.get(
      `/projects/${encodedProjectId}/resources/${encodedResourceId}/graphs/${encodedPath}/metadata/content`,
      { headers: { Accept: 'text/turtle, text/n3, application/ld+json, application/json;q=0.5, */*;q=0.1' } },
    );
  } catch {
    return null;
  }
}

async function parseErrorResponse(response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    return (
      payload?.title ||
      payload?.message ||
      payload?.detail ||
      `Coscine request failed with HTTP ${response.status}.`
    );
  }

  const text = await response.text().catch(() => '');
  return text || `Coscine request failed with HTTP ${response.status}.`;
}

function encodeCoscinePath(path) {
  return String(path ?? '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeCollection(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of ['data', 'items', 'entries', 'children', 'files', 'values']) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return Object.values(payload).find(Array.isArray) ?? [];
}

function getEntryPath(entry) {
  return String(
    entry?.path ?? entry?.name ?? entry?.fileName ?? entry?.key ?? entry?.id ?? entry?.displayName ?? '',
  );
}

function isDirectoryEntry(entry) {
  const type = String(entry?.type ?? entry?.kind ?? '').toLowerCase();
  return entry?.isDirectory === true || entry?.isFolder === true || type === 'folder' || type === 'directory';
}

function dedupeFiles(files) {
  const seen = new Set();

  return files.filter((file) => {
    const key = file.path || JSON.stringify(file);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
