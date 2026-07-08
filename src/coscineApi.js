import { DataFactory, Parser, Writer } from 'n3';

const COSCINE_API_BASE = '/coscine-api';
const EMULATOR_STORAGE_KEY = 'coscine-upload:emulator-state:v1';
const DCTERMS_CONFORMS_TO = 'http://purl.org/dc/terms/conformsTo';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SH_TARGET_CLASS = 'http://www.w3.org/ns/shacl#targetClass';
export const COSCINE_ENVIRONMENTS = {
  REAL: 'real',
  TEST: 'test',
};

const EMULATOR_DELAY_MS = 180;
const emulatorStorage = new Map();
const emulatorCustomResources = [];
let emulatorResourceCounter = 1;

const emulatorCustomProject = {
  id: 'test-project-custom-resources',
  displayName: 'Test Project: Custom Resources',
};

const emulatorProfiles = new Map();

const { namedNode, quad } = DataFactory;

loadPersistentEmulatorState();

function buildAuthorizationHeader(apiToken) {
  const trimmedToken = String(apiToken ?? '').trim();

  if (!trimmedToken) {
    throw new Error('Enter a Coscine API token first.');
  }

  return trimmedToken.toLowerCase().startsWith('bearer ') ? trimmedToken : `Bearer ${trimmedToken}`;
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

async function fetchCoscineJson(path, apiToken, options = {}) {
  const response = await fetch(`${COSCINE_API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: buildAuthorizationHeader(apiToken),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function fetchCoscine(path, apiToken, options = {}) {
  const response = await fetch(`${COSCINE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: buildAuthorizationHeader(apiToken),
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  return response;
}

async function fetchCoscineRaw(path, apiToken, options = {}) {
  return fetch(`${COSCINE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: buildAuthorizationHeader(apiToken),
      ...options.headers,
    },
  });
}

function encodeCoscinePath(path) {
  return String(path ?? '')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      encodeURIComponent(segment).replace(/[!'()*]/g, (character) =>
        `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

function emulatorResourceIdentity(resource) {
  const shaclContent = String(resource?.shaclContent ?? '').trim();

  if (shaclContent) {
    return `shacl:${hashString(shaclContent)}`;
  }

  return `resource:${resource?.applicationProfile?.uri || resource?.id || ''}`;
}

function dedupeEmulatorCustomResources(resources) {
  const uniqueResources = new Map();

  for (const resource of resources) {
    const identity = emulatorResourceIdentity(resource);

    if (!uniqueResources.has(identity)) {
      uniqueResources.set(identity, resource);
    }
  }

  return Array.from(uniqueResources.values());
}

function parseTurtle(content) {
  const parser = new Parser({ format: 'text/turtle' });
  return parser.parse(content);
}

async function serializeTurtle(quads) {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ format: 'text/turtle' });
    writer.addQuads(quads);
    writer.end((error, result) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result);
    });
  });
}

function findRootSubject(quads) {
  const conformsToSubject = quads.find((item) => item.predicate.value === DCTERMS_CONFORMS_TO)?.subject;

  if (conformsToSubject) {
    return conformsToSubject;
  }

  const subjects = new Map();
  const objectBlankNodes = new Set();

  for (const item of quads) {
    subjects.set(item.subject.id, item.subject);

    if (item.object.termType === 'BlankNode') {
      objectBlankNodes.add(item.object.id);
    }
  }

  const candidates = Array.from(subjects.values()).filter((subject) => !objectBlankNodes.has(subject.id));

  if (candidates.length === 1) {
    return candidates[0];
  }

  if (subjects.size === 1) {
    return Array.from(subjects.values())[0];
  }

  return null;
}

function getApplicationProfileTargetClass(profile) {
  const quads = parseTurtle(profile.shapes);
  const targetClasses = quads
    .filter((item) => item.predicate.value === SH_TARGET_CLASS && item.object.termType === 'NamedNode')
    .map((item) => item.object.value);
  const uniqueTargetClasses = Array.from(new Set(targetClasses));

  return uniqueTargetClasses.length === 1 ? uniqueTargetClasses[0] : profile.baseUri;
}

async function normalizeMetadataLikeSdk(metadataContent, profile) {
  const targetClass = getApplicationProfileTargetClass(profile);
  const quads = parseTurtle(metadataContent);
  const rootSubject = findRootSubject(quads);

  if (!rootSubject) {
    throw new Error('Could not identify the root metadata subject in the serialized form data.');
  }

  const normalizedQuads = quads.filter(
    (item) => !(item.subject.equals(rootSubject) && item.predicate.value === DCTERMS_CONFORMS_TO),
  );

  const hasTargetClassType = normalizedQuads.some(
    (item) =>
      item.subject.equals(rootSubject) &&
      item.predicate.value === RDF_TYPE &&
      item.object.termType === 'NamedNode' &&
      item.object.value === targetClass,
  );

  if (!hasTargetClassType) {
    normalizedQuads.unshift(quad(rootSubject, namedNode(RDF_TYPE), namedNode(targetClass)));
  }

  return serializeTurtle(normalizedQuads);
}

async function waitForEmulator() {
  await new Promise((resolve) => {
    globalThis.setTimeout(resolve, EMULATOR_DELAY_MS);
  });
}

function getPersistentStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function loadPersistentEmulatorState() {
  const storage = getPersistentStorage();

  if (!storage) {
    return;
  }

  try {
    const payload = JSON.parse(storage.getItem(EMULATOR_STORAGE_KEY) || '{}');

    if (Array.isArray(payload.customResources)) {
      const uniqueCustomResources = dedupeEmulatorCustomResources(payload.customResources);
      emulatorCustomResources.splice(0, emulatorCustomResources.length, ...uniqueCustomResources);
      emulatorProfiles.clear();

      for (const resource of emulatorCustomResources) {
        const profileUri = resource.applicationProfile?.uri;

        if (profileUri && resource.shaclContent) {
          emulatorProfiles.set(profileUri, String(resource.shaclContent));
        }
      }

      if (uniqueCustomResources.length !== payload.customResources.length) {
        savePersistentEmulatorState();
      }
    }

    if (Array.isArray(payload.uploads)) {
      emulatorStorage.clear();

      for (const upload of payload.uploads) {
        if (upload?.storageKey && upload.entry) {
          emulatorStorage.set(upload.storageKey, upload.entry);
        }
      }
    }

    if (Number.isInteger(payload.nextResourceCounter) && payload.nextResourceCounter > 0) {
      emulatorResourceCounter = payload.nextResourceCounter;
    }
  } catch {
  }
}

function savePersistentEmulatorState() {
  const storage = getPersistentStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(
      EMULATOR_STORAGE_KEY,
      JSON.stringify({
        customResources: emulatorCustomResources,
        nextResourceCounter: emulatorResourceCounter,
        uploads: Array.from(emulatorStorage.entries()).map(([storageKey, entry]) => ({
          storageKey,
          entry,
        })),
      }),
    );
  } catch {
  }
}

function createRealCoscineService() {
  return {
    environment: COSCINE_ENVIRONMENTS.REAL,
    label: 'Production environment',
    tokenRequired: true,
    fetchResourceOptions: fetchCoscineResourceOptions,
    fetchApplicationProfileDefinition: fetchCoscineApplicationProfileDefinition,
    fetchResourceDetails: fetchCoscineResourceDetails,
    downloadFile: downloadCoscineFile,
    uploadFile: uploadFileToCoscine,
  };
}

function createEmulatedCoscineService() {
  function listVirtualResources() {
    return dedupeEmulatorCustomResources(emulatorCustomResources).map((resource) => ({
      projectId: emulatorCustomProject.id,
      projectName: emulatorCustomProject.displayName,
      resourceId: resource.id,
      resourceName: resource.displayName || resource.name || resource.id,
      resourceType: resource.type?.displayName || resource.type?.name || '',
      applicationProfileUri: resource.applicationProfile?.uri || '',
      shaclFileName: resource.shaclFileName || '',
      isVirtual: true,
      isCustomResource: true,
    }));
  }

  function listUploadedFiles() {
    return Array.from(emulatorStorage.entries()).map(([storageKey, entry]) => ({
      storageKey,
      projectId: entry.projectId,
      projectName: entry.projectName,
      resourceId: entry.resourceId,
      resourceName: entry.resourceName,
      fileName: entry.fileName,
      fileSize: entry.fileSize,
      fileType: entry.fileType,
      uploadedAt: entry.uploadedAt,
      metadataContent: entry.metadataContent,
      shaclFileName: entry.shaclFileName || '',
    }));
  }

  return {
    environment: COSCINE_ENVIRONMENTS.TEST,
    label: 'Test environment',
    tokenRequired: false,
    async fetchResourceOptions() {
      await waitForEmulator();
      const resources = listVirtualResources();
      const projects = new Map();

      for (const resource of resources) {
        projects.set(resource.projectId, resource.projectName);
      }

      return {
        projects: projects.size,
        resources,
      };
    },
    async getViewData() {
      await waitForEmulator();
      return {
        resources: listVirtualResources(),
        uploads: listUploadedFiles(),
      };
    },
    async deleteResource({ projectId, resourceId }) {
      await waitForEmulator();

      if (!projectId || !resourceId) {
        throw new Error('Select a test resource to delete.');
      }

      const resourceIndex = emulatorCustomResources.findIndex((resource) => resource.id === resourceId);

      if (resourceIndex < 0) {
        throw new Error(`The Coscine emulator has no resource ${resourceId}.`);
      }

      const [deletedResource] = emulatorCustomResources.splice(resourceIndex, 1);
      const profileUri = deletedResource?.applicationProfile?.uri;

      if (profileUri) {
        emulatorProfiles.delete(profileUri);
      }

      for (const [storageKey, entry] of Array.from(emulatorStorage.entries())) {
        if (entry.projectId === projectId && entry.resourceId === resourceId) {
          emulatorStorage.delete(storageKey);
        }
      }

      savePersistentEmulatorState();
    },
    async deleteUploadedFile({ storageKey }) {
      await waitForEmulator();

      if (!storageKey) {
        throw new Error('Select an uploaded file to delete.');
      }

      emulatorStorage.delete(storageKey);
      savePersistentEmulatorState();
    },
    async createResource({ name, shaclFileName, shaclContent }) {
      await waitForEmulator();

      const normalizedName = String(name ?? '').trim();

      if (!normalizedName) {
        throw new Error('Enter a resource name.');
      }

      if (!String(shaclContent ?? '').trim()) {
        throw new Error('Choose a SHACL form file.');
      }

      const existingResource = emulatorCustomResources.find(
        (resource) => emulatorResourceIdentity(resource) === `shacl:${hashString(String(shaclContent).trim())}`,
      );

      if (existingResource) {
        return {
          projectId: emulatorCustomProject.id,
          projectName: emulatorCustomProject.displayName,
          resourceId: existingResource.id,
          resourceName: existingResource.displayName || existingResource.name || existingResource.id,
          resourceType: existingResource.type?.displayName || existingResource.type?.name || '',
          applicationProfileUri: existingResource.applicationProfile?.uri || '',
          shaclFileName: existingResource.shaclFileName || '',
          isVirtual: true,
          isCustomResource: true,
        };
      }

      const applicationProfileUri = `https://coscine.local/ap/custom-${emulatorResourceCounter}`;
      const resource = {
        id: `test-resource-custom-${emulatorResourceCounter}`,
        displayName: normalizedName,
        type: { displayName: 'Custom SHACL' },
        applicationProfile: { uri: applicationProfileUri },
        shaclFileName: shaclFileName || 'shacl.ttl',
      };

      emulatorResourceCounter += 1;
      emulatorCustomResources.push({ ...resource, shaclContent });

      emulatorProfiles.set(applicationProfileUri, String(shaclContent));
      savePersistentEmulatorState();

      return {
        projectId: emulatorCustomProject.id,
        projectName: emulatorCustomProject.displayName,
        resourceId: resource.id,
        resourceName: resource.displayName,
        resourceType: resource.type.displayName,
        applicationProfileUri,
        shaclFileName: resource.shaclFileName,
        isVirtual: true,
        isCustomResource: true,
      };
    },
    async fetchApplicationProfileDefinition(_apiToken, profileUri) {
      await waitForEmulator();

      const normalizedProfileUri = String(profileUri ?? '').trim();
      const shapes = emulatorProfiles.get(normalizedProfileUri);

      if (!shapes) {
        throw new Error(`The Coscine emulator has no profile definition for ${profileUri}.`);
      }

      return {
        baseUri: normalizedProfileUri,
        name: normalizedProfileUri,
        shapes,
      };
    },
    async uploadFile({ projectId, resourceId, file, fileName, metadataContent, profile }) {
      await waitForEmulator();

      if (!projectId || !resourceId) {
        throw new Error('Select a Coscine resource first.');
      }

      if (!file) {
        throw new Error('Choose a file to upload.');
      }

      if (!String(metadataContent ?? '').trim()) {
        throw new Error('Save Coscine metadata before uploading.');
      }

      const normalizedFileName = fileName || file.name;
      const normalizedMetadataContent = await normalizeMetadataLikeSdk(metadataContent, profile);
      const storageKey = `${projectId}/${resourceId}/${encodeCoscinePath(normalizedFileName)}`;
      const resource = listVirtualResources().find(
        (item) => item.projectId === projectId && item.resourceId === resourceId,
      );

      emulatorStorage.set(storageKey, {
        projectId,
        projectName: resource?.projectName || projectId,
        resourceId,
        resourceName: resource?.resourceName || resourceId,
        fileName: normalizedFileName,
        fileSize: file.size,
        fileType: file.type,
        metadataContent: normalizedMetadataContent,
        shaclFileName: resource?.shaclFileName || '',
        uploadedAt: new Date().toISOString(),
      });
      savePersistentEmulatorState();

      return {
        storageKey,
        version: emulatorStorage.size,
      };
    },
  };
}

export function createCoscineService(environment = COSCINE_ENVIRONMENTS.REAL) {
  return environment === COSCINE_ENVIRONMENTS.TEST ? createEmulatedCoscineService() : createRealCoscineService();
}

export async function fetchCoscineProjects(apiToken) {
  const payload = await fetchCoscineJson(
    '/projects?PageNumber=1&PageSize=100&OrderBy=name%20asc',
    apiToken,
  );

  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function fetchCoscineResourcesForProject(apiToken, projectId) {
  const encodedProjectId = encodeURIComponent(projectId);
  const payload = await fetchCoscineJson(
    `/projects/${encodedProjectId}/resources?PageNumber=1&PageSize=100&OrderBy=name%20asc`,
    apiToken,
  );

  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function fetchCoscineResourceOptions(apiToken) {
  const projects = await fetchCoscineProjects(apiToken);
  const resourceGroups = await Promise.all(
    projects.map(async (project) => {
      const resources = await fetchCoscineResourcesForProject(apiToken, project.id);

      return resources.map((resource) => ({
        projectId: project.id,
        projectName: project.displayName || project.name || project.slug || project.id,
        resourceId: resource.id,
        resourceName: resource.displayName || resource.name || resource.id,
        resourceType: resource.type?.displayName || resource.type?.name || '',
        applicationProfileUri: resource.applicationProfile?.uri || '',
      }));
    }),
  );

  return {
    projects: projects.length,
    resources: resourceGroups.flat(),
  };
}

export async function fetchCoscineApplicationProfileDefinition(apiToken, profileUri) {
  const normalizedProfileUri = String(profileUri ?? '').trim();

  if (!normalizedProfileUri) {
    throw new Error('Selected Coscine resource has no application profile URI.');
  }

  const encodedProfileUri = encodeURIComponent(normalizedProfileUri);
  const response = await fetch(
    `${COSCINE_API_BASE}/application-profiles/profiles/${encodedProfileUri}/raw`,
    {
      headers: {
        Accept: 'text/turtle',
        Authorization: buildAuthorizationHeader(apiToken),
      },
    },
  );

  if (!response.ok) {
    throw new Error(await parseErrorResponse(response));
  }

  const shapes = await response.text();

  if (!shapes.trim()) {
    throw new Error(`Coscine returned an empty profile definition for ${profileUri}.`);
  }

  return {
    baseUri: normalizedProfileUri,
    name: normalizedProfileUri,
    shapes,
  };
}

export async function fetchCoscineResourceDetails(apiToken, { projectId, resourceId }) {
  if (!projectId || !resourceId) {
    throw new Error('Project ID and resource ID are required.');
  }

  const files = await fetchCoscineResourceFiles(apiToken, projectId, resourceId);

  return {
    files,
    loadedAt: new Date().toISOString(),
  };
}

export async function downloadCoscineFile(apiToken, { projectId, resourceId, path }) {
  if (!projectId || !resourceId || !path) {
    throw new Error('Project ID, resource ID, and file path are required.');
  }

  if (isInternalCoscinePath(path) || isDirectoryPath(path)) {
    throw new Error('Select a file to download.');
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const encodedResourceId = encodeURIComponent(resourceId);
  const encodedPath = encodeCoscinePath(path);

  return fetchCoscine(
    `/projects/${encodedProjectId}/resources/${encodedResourceId}/storage/${encodedPath}/content`,
    apiToken,
  );
}

async function fetchCoscineResourceFiles(apiToken, projectId, resourceId) {
  const rootEntries = await fetchCoscineStorageEntries(apiToken, projectId, resourceId, '');
  const files = [];
  const folders = [...rootEntries];
  const seenFolders = new Set();

  while (folders.length > 0) {
    const entry = folders.shift();
    const path = getCoscineEntryPath(entry);

    if (!path || isInternalCoscinePath(path) || seenFolders.has(path)) {
      continue;
    }

    if (isCoscineDirectoryEntry(entry)) {
      seenFolders.add(path);
      const children = await fetchCoscineStorageEntries(apiToken, projectId, resourceId, path).catch(() => []);
      folders.push(...children);
      continue;
    }

    if (isCoscineFileEntry(entry)) {
      files.push(await withCoscineMetadata(apiToken, projectId, resourceId, entry, path));
    }
  }

  const rootFiles = await Promise.all(
    rootEntries
      .filter((entry) => isCoscineFileEntry(entry))
      .map((entry) => withCoscineMetadata(apiToken, projectId, resourceId, entry, getCoscineEntryPath(entry))),
  );

  return dedupeCoscineFiles([...rootFiles, ...files]);
}

async function fetchCoscineStorageEntries(apiToken, projectId, resourceId, path) {
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
      return normalizeCoscineCollection(await fetchCoscineJson(candidate, apiToken));
    } catch {
      // Coscine storage route behavior differs by resource type; try the next route shape.
    }
  }

  return [];
}

async function withCoscineMetadata(apiToken, projectId, resourceId, entry, path) {
  return {
    ...entry,
    path,
    metadata: await fetchCoscineFileMetadata(apiToken, projectId, resourceId, path),
  };
}

async function fetchCoscineFileMetadata(apiToken, projectId, resourceId, path) {
  if (!path) {
    return null;
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const encodedResourceId = encodeURIComponent(resourceId);
  const encodedPath = encodeCoscinePath(path);

  try {
    const response = await fetchCoscine(
      `/projects/${encodedProjectId}/resources/${encodedResourceId}/graphs/${encodedPath}/metadata/content`,
      apiToken,
      {
        headers: {
          Accept: 'text/turtle, text/n3, application/ld+json, application/json;q=0.5, */*;q=0.1',
        },
      },
    );

    const contentType = response.headers.get('content-type') ?? '';
    return contentType.includes('application/json') ? response.json() : response.text();
  } catch {
    return null;
  }
}

function normalizeCoscineCollection(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.children)) {
    return payload.children;
  }

  if (Array.isArray(payload?.entries)) {
    return payload.entries;
  }

  return [];
}

function getCoscineEntryPath(entry) {
  return String(entry?.path ?? entry?.name ?? entry?.fileName ?? entry?.key ?? entry?.id ?? '').replace(/^\/+/, '');
}

function isCoscineDirectoryEntry(entry) {
  const type = String(entry?.type ?? entry?.kind ?? entry?.resourceType ?? '').toLowerCase();
  const path = getCoscineEntryPath(entry);

  return Boolean(
    isDirectoryPath(path) ||
      entry?.isFolder ||
      entry?.isDirectory ||
      entry?.hasChildren ||
      type.includes('folder') ||
      type.includes('directory')
  );
}

function isCoscineFileEntry(entry) {
  const path = getCoscineEntryPath(entry);
  return Boolean(path && !isInternalCoscinePath(path) && !isCoscineDirectoryEntry(entry));
}

function isDirectoryPath(path) {
  return String(path ?? '').endsWith('/');
}

function isInternalCoscinePath(path) {
  const normalizedPath = String(path ?? '').replace(/^\/+/, '');
  return normalizedPath === '.coscine' || normalizedPath.startsWith('.coscine/');
}

function dedupeCoscineFiles(files) {
  const uniqueFiles = new Map();

  for (const file of files) {
    const path = getCoscineEntryPath(file);

    if (isCoscineFileEntry(file) && !uniqueFiles.has(path)) {
      uniqueFiles.set(path, file);
    }
  }

  return Array.from(uniqueFiles.values());
}

export async function uploadFileToCoscine({
  apiToken,
  projectId,
  resourceId,
  file,
  fileName,
  metadataContent,
  profile,
}) {
  if (!projectId || !resourceId) {
    throw new Error('Select a Coscine resource first.');
  }

  if (!file) {
    throw new Error('Choose a file to upload.');
  }

  if (!String(metadataContent ?? '').trim()) {
    throw new Error('Save Coscine metadata before uploading.');
  }

  const encodedProjectId = encodeURIComponent(projectId);
  const encodedResourceId = encodeURIComponent(resourceId);
  const normalizedFileName = fileName || file.name;
  const encodedPath = encodeCoscinePath(fileName || file.name);
  const graphMetadataPath = `/projects/${encodedProjectId}/resources/${encodedResourceId}/graphs/${encodedPath}/metadata/content`;
  const graphMetadataVersionsPath = `/projects/${encodedProjectId}/resources/${encodedResourceId}/graphs/${encodedPath}/metadata/versions`;
  const storagePath = `/projects/${encodedProjectId}/resources/${encodedResourceId}/storage/${encodedPath}/content`;
  const normalizedMetadataContent = await normalizeMetadataLikeSdk(metadataContent, profile);

  await fetchCoscine(graphMetadataPath, apiToken, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/turtle',
    },
    body: normalizedMetadataContent,
  });

  const formData = new FormData();
  formData.append('file', file, normalizedFileName);

  const createStorageResponse = await fetchCoscineRaw(storagePath, apiToken, {
    method: 'POST',
    body: formData,
  });

  if (!createStorageResponse.ok) {
    if (createStorageResponse.status !== 409) {
      throw new Error(await parseErrorResponse(createStorageResponse));
    }

    const updateFormData = new FormData();
    updateFormData.append('file', file, normalizedFileName);

    await fetchCoscine(storagePath, apiToken, {
      method: 'PUT',
      body: updateFormData,
    });
  }

  const graphMetadataVersions = await fetchCoscineJson(graphMetadataVersionsPath, apiToken);

  if (!Array.isArray(graphMetadataVersions?.data) || graphMetadataVersions.data.length === 0) {
    throw new Error('Coscine accepted the upload, but no graph metadata version is listed for the file.');
  }
}
