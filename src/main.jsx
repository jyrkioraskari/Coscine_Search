import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@ulb-darmstadt/shacl-form';
import coscineLogo from './assets/coscine_rgb.svg';
import './styles.css';

function App() {
  const [apiKey, setApiKey] = useState('');
  const [resources, setResources] = useState([]);
  const [projectsCount, setProjectsCount] = useState(0);
  const [selectedKey, setSelectedKey] = useState('');
  const [resourceDetails, setResourceDetails] = useState(null);
  const [profile, setProfile] = useState(null);
  const [filterRdf, setFilterRdf] = useState('');
  const [rangeFilters, setRangeFilters] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isLoadingSelection, setIsLoadingSelection] = useState(false);

  const selectedResource = useMemo(
    () => resources.find((resource) => resourceKey(resource) === selectedKey) ?? null,
    [resources, selectedKey],
  );

  const files = resourceDetails?.files ?? [];
  const filteredFiles = useMemo(
    () => applyRangeFilters(filterFiles(files, filterRdf), rangeFilters),
    [files, filterRdf, rangeFilters],
  );

  async function loadResources(event) {
    event.preventDefault();
    setError('');
    setStatus('Loading resources...');
    setResources([]);
    setSelectedKey('');
    setResourceDetails(null);
    setProfile(null);
    setFilterRdf('');
    setRangeFilters({});
    setIsLoadingResources(true);

    try {
      const payload = await postJson('/api/coscine/scan', { apiKey });
      setProjectsCount(payload.projects ?? 0);
      setResources(payload.resources ?? []);
      setStatus(
        payload.resources?.length
          ? 'Select a resource to load files and its SHACL metadata form.'
          : 'No resources returned for this API key.',
      );
    } catch (loadError) {
      setError(loadError.message || 'Could not load Coscine resources.');
      setStatus('');
    } finally {
      setIsLoadingResources(false);
    }
  }

  useEffect(() => {
    if (!apiKey.trim() || !selectedResource) {
      return undefined;
    }

    let isActive = true;
    setError('');
    setStatus('Loading selected resource...');
    setResourceDetails(null);
    setProfile(null);
    setFilterRdf('');
    setRangeFilters({});
    setIsLoadingSelection(true);

    const detailsRequest = postJson('/api/coscine/resource-details', {
      apiKey,
      projectId: selectedResource.projectId,
      resourceId: selectedResource.resourceId,
    });
    const profileRequest = selectedResource.applicationProfileUri
      ? postJson('/api/coscine/application-profile', {
          apiKey,
          profileUri: selectedResource.applicationProfileUri,
        }).catch((profileError) => ({ profileError }))
      : Promise.resolve(null);

    Promise.all([detailsRequest, profileRequest])
      .then(([details, loadedProfile]) => {
        if (!isActive) {
          return;
        }
        setResourceDetails(details);
        setProfile(loadedProfile?.profileError ? null : loadedProfile);
        setStatus(
          loadedProfile?.profileError
            ? `Loaded ${details.files?.length ?? 0} files. Could not load SHACL form: ${loadedProfile.profileError.message}`
            : loadedProfile
            ? `Loaded ${details.files?.length ?? 0} files and SHACL form.`
            : `Loaded ${details.files?.length ?? 0} files. No application profile URI was found.`,
        );
      })
      .catch((selectionError) => {
        if (!isActive) {
          return;
        }
        setError(selectionError.message || 'Could not load the selected resource.');
        setStatus('');
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingSelection(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [apiKey, selectedResource]);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <img src={coscineLogo} alt="Coscine" className="coscine-logo" />
          <div>
            <p className="eyebrow">RWTH Coscine</p>
            <h1>Resources and files</h1>
          </div>
        </div>

        <form className="token-form" onSubmit={loadResources}>
          <input
            type="password"
            value={apiKey}
            placeholder="Coscine API key"
            autoComplete="off"
            onChange={(event) => setApiKey(event.target.value)}
          />
          <button type="submit" disabled={isLoadingResources || !apiKey.trim()}>
            {isLoadingResources ? 'Loading...' : 'Load resources'}
          </button>
        </form>
      </header>

      {error ? <div className="alert">{error}</div> : null}
      {status ? <div className="status-line">{status}</div> : null}

      <section className="summary-strip">
        <span>{projectsCount} projects</span>
        <span>{resources.length} resources</span>
        <span>{files.length} files in selected resource</span>
        <span>{filteredFiles.length} visible</span>
      </section>

      <section className="content-grid">
        <aside className="resource-list">
          {resources.length ? (
            groupResourcesByProject(resources).map((project) => (
              <div className="project-group" key={project.id}>
                <div className="project-heading">
                  <strong>{project.name}</strong>
                  <span>{project.resources.length}</span>
                </div>
                {project.resources.map((resource) => (
                  <button
                    className={selectedKey === resourceKey(resource) ? 'resource-row active' : 'resource-row'}
                    key={resourceKey(resource)}
                    type="button"
                    onClick={() => setSelectedKey(resourceKey(resource))}
                  >
                    <strong>{resource.resourceName}</strong>
                    <small>{resource.resourceType || 'Resource'}</small>
                  </button>
                ))}
              </div>
            ))
          ) : (
            <div className="empty-state">Enter an API key and load resources.</div>
          )}
        </aside>

        <section className="details-panel">
          {selectedResource ? (
            <ResourceWorkspace
              apiKey={apiKey}
              files={filteredFiles}
              isLoading={isLoadingSelection}
              profile={profile}
              rawFiles={files}
              rangeFilters={rangeFilters}
              resource={selectedResource}
              onFilterRdfChange={setFilterRdf}
              onRangeFiltersChange={setRangeFilters}
            />
          ) : (
            <div className="empty-state">Select a resource to load files and its SHACL form.</div>
          )}
        </section>
      </section>
    </main>
  );
}

function ResourceWorkspace({
  apiKey,
  files,
  isLoading,
  onFilterRdfChange,
  onRangeFiltersChange,
  profile,
  rangeFilters,
  rawFiles,
  resource,
}) {
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [formWidth, setFormWidth] = useState(64);
  const selectedFile = useMemo(
    () => rawFiles.find((file) => filePath(file) === selectedFilePath) ?? null,
    [rawFiles, selectedFilePath],
  );

  useEffect(() => {
    setSelectedFilePath('');
    onFilterRdfChange('');
    onRangeFiltersChange({});
  }, [resource.projectId, resource.resourceId]);

  return (
    <>
      <div className="detail-header">
        <div>
          <p className="eyebrow">{resource.projectName}</p>
          <h2>{resource.resourceName}</h2>
        </div>
        <span>{rawFiles.length} files</span>
      </div>

      <div className="metadata-line">
        <span>{resource.resourceType || 'Resource type unknown'}</span>
        <span>{resource.applicationProfileUri || 'No application profile URI'}</span>
      </div>

      <div
        className="workspace-split"
        style={{
          '--form-width': `${formWidth}%`,
          '--files-width': `${100 - formWidth}%`,
        }}
      >
        <MetadataFilterForm
          isLoading={isLoading}
          onRangeFiltersChange={onRangeFiltersChange}
          profile={profile}
          resource={resource}
          selectedFile={selectedFile}
          onFilterRdfChange={onFilterRdfChange}
          onClear={() => {
            setSelectedFilePath('');
            onFilterRdfChange('');
            onRangeFiltersChange({});
          }}
        />
        <ResizeHandle
          onResize={(delta) => {
            setFormWidth((currentWidth) => Math.min(78, Math.max(42, currentWidth + delta)));
          }}
        />
        <FileTable
          apiKey={apiKey}
          files={files}
          isLoading={isLoading}
          resource={resource}
          selectedFilePath={selectedFilePath}
          onSelectFile={(file) => setSelectedFilePath(filePath(file))}
        />
      </div>
    </>
  );
}

function ResizeHandle({ onResize }) {
  const startXRef = useRef(0);

  function handlePointerDown(event) {
    startXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const deltaPx = event.clientX - startXRef.current;
    const parentWidth = event.currentTarget.parentElement?.getBoundingClientRect().width ?? 1;
    startXRef.current = event.clientX;
    onResize((deltaPx / parentWidth) * 100);
  }

  function handlePointerUp(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <button
      aria-label="Resize form and files"
      className="resize-handle"
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}

function MetadataFilterForm({
  isLoading,
  onClear,
  onFilterRdfChange,
  onRangeFiltersChange,
  profile,
  resource,
  selectedFile,
}) {
  const normalizedMetadata = normalizeMetadataForForm(selectedFile?.metadata, selectedFile);
  const selectedFileValues = normalizedMetadata.values;
  const selectedFileSubject = normalizedMetadata.subject;
  const formKey = `${resource.projectId}:${resource.resourceId}:${profile?.baseUri ?? 'none'}:${filePath(selectedFile)}`;

  return (
    <section className="form-panel">
      <div className="panel-title">
        <div>
          <h3>Metadata form</h3>
          <p>{selectedFile ? filePath(selectedFile) : 'Select a file to fill the form.'}</p>
        </div>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>

      {isLoading ? <p className="muted">Loading SHACL form...</p> : null}
      {!isLoading && !profile?.shapes ? (
        <p className="muted">No SHACL application profile is available for this resource.</p>
      ) : null}
      {!isLoading && profile?.shapes && selectedFile && !selectedFileValues ? (
        <p className="muted">The selected file has no RDF metadata values to prefill this form.</p>
      ) : null}
      {!isLoading && profile?.shapes ? (
        <ShaclFormHost
          formKey={formKey}
          shapes={profile.shapes}
          values={selectedFileValues}
          valuesSubject={selectedFileSubject}
          onRangeFiltersChange={onRangeFiltersChange}
          onSerializedChange={onFilterRdfChange}
        />
      ) : null}
    </section>
  );
}

function ShaclFormHost({
  formKey,
  onRangeFiltersChange,
  onSerializedChange,
  shapes,
  values,
  valuesSubject,
}) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !shapes) {
      onSerializedChange('');
      return undefined;
    }

    host.replaceChildren();

    const formElement = document.createElement('shacl-form');
    formElement.setAttribute('data-shapes', shapes);
    formElement.setAttribute('data-show-root-shape-label', '');

    if (values) {
      formElement.setAttribute('data-values', values);
    }

    if (valuesSubject) {
      formElement.setAttribute('data-values-subject', valuesSubject);
    }

    const updateSerialized = (event) => {
      event?.preventDefault?.();
      onSerializedChange(collectFormFilterText(formElement));
    };
    let cleanupLiveFieldListeners = () => {};
    const enhanceForm = () => {
      enhanceRangeFields(formElement, onRangeFiltersChange);
      cleanupLiveFieldListeners();
      cleanupLiveFieldListeners = attachLiveFieldListeners(formElement, updateSerialized);
    };

    formElement.addEventListener('input', updateSerialized, true);
    formElement.addEventListener('change', updateSerialized);
    formElement.addEventListener('submit', updateSerialized);
    formElement.addEventListener('ready', enhanceForm);
    host.appendChild(formElement);

    return () => {
      cleanupLiveFieldListeners();
      formElement.removeEventListener('input', updateSerialized, true);
      formElement.removeEventListener('change', updateSerialized);
      formElement.removeEventListener('submit', updateSerialized);
      formElement.removeEventListener('ready', enhanceForm);
      host.replaceChildren();
    };
  }, [formKey, onRangeFiltersChange, onSerializedChange, shapes, values, valuesSubject]);

  return <div className="shacl-form-host" ref={hostRef} />;
}

function enhanceRangeFields(formElement, onRangeFiltersChange) {
  const root = formElement.shadowRoot ?? formElement;
  ensureRangeFieldStyles(root);
  const editors = Array.from(root.querySelectorAll('.property-instance[data-path] .editor')).filter((editor) =>
    isRangeEditor(editor),
  );

  for (const editor of editors) {
    if (editor.dataset.rangeEnhanced === 'true') {
      continue;
    }

    const propertyInstance = editor.closest('.property-instance[data-path]');
    const path = propertyInstance?.dataset.path;
    const field = editor.closest('[part="field"]') ?? editor.parentElement;

    if (!path || !field) {
      continue;
    }

    editor.dataset.rangeEnhanced = 'true';
    editor.dataset.rangeRole = 'min';

    const wrapper = document.createElement('div');
    wrapper.className = 'metadata-range-inline';

    const toInput = document.createElement('input');
    toInput.className = 'editor metadata-range-inline__to';
    toInput.type = getRangeInputType(editor);
    toInput.step = editor.step || (toInput.type === 'number' ? 'any' : '1');
    toInput.min = editor.min || '';
    toInput.max = editor.max || '';
    toInput.placeholder = 'to';
    toInput.dataset.rangeRole = 'max';
    toInput.dataset.path = path;
    toInput.setAttribute('aria-label', 'Range end');

    editor.parentNode.insertBefore(wrapper, editor);
    wrapper.appendChild(editor);
    wrapper.appendChild(toInput);

    const publishRange = () => {
      const min = formInputToRangeValue(editor);
      const max = formInputToRangeValue(toInput);

      onRangeFiltersChange((currentFilters) => {
        const nextFilters = { ...currentFilters };

        if (Number.isFinite(min) || Number.isFinite(max)) {
          nextFilters[path] = [
            Number.isFinite(min) ? min : Number.NEGATIVE_INFINITY,
            Number.isFinite(max) ? max : Number.POSITIVE_INFINITY,
          ];
        } else {
          delete nextFilters[path];
        }

        return nextFilters;
      });
      formElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    };

    editor.addEventListener('input', publishRange);
    editor.addEventListener('change', publishRange);
    toInput.addEventListener('input', publishRange);
    toInput.addEventListener('change', publishRange);
  }
}

function ensureRangeFieldStyles(root) {
  if (root.querySelector('#coscine-range-field-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'coscine-range-field-styles';
  style.textContent = `
    .metadata-range-inline {
      display: grid;
      grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr);
      gap: 10px;
      width: 100%;
    }

    .metadata-range-inline::before {
      content: "from";
      grid-column: 1;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .metadata-range-inline::after {
      content: "to";
      grid-column: 2;
      grid-row: 1;
      color: #64748b;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .metadata-range-inline:has(input[type="date"])::before,
    .metadata-range-inline:has(input[type="datetime-local"])::before {
      content: "from date";
    }

    .metadata-range-inline:has(input[type="date"])::after,
    .metadata-range-inline:has(input[type="datetime-local"])::after {
      content: "to date";
    }
  `;
  root.prepend(style);
}

function attachLiveFieldListeners(formElement, updateSerialized) {
  const root = formElement.shadowRoot ?? formElement;
  const cleanupCallbacks = [];
  const editors = Array.from(root.querySelectorAll('.editor'));
  const events = ['input', 'keyup', 'change'];

  for (const editor of editors) {
    for (const eventName of events) {
      editor.addEventListener(eventName, updateSerialized);
      cleanupCallbacks.push(() => editor.removeEventListener(eventName, updateSerialized));
    }

    const innerFields = Array.from(
      editor.shadowRoot?.querySelectorAll('input, textarea, select') ?? [],
    );

    for (const innerField of innerFields) {
      for (const eventName of events) {
        innerField.addEventListener(eventName, updateSerialized);
        cleanupCallbacks.push(() => innerField.removeEventListener(eventName, updateSerialized));
      }
    }
  }

  return () => {
    cleanupCallbacks.forEach((cleanup) => cleanup());
  };
}

function formInputToRangeValue(input) {
  const value = getEditorCurrentValue(input);

  if (!value) {
    return Number.NaN;
  }

  const inputType = getEditorInputType(input);
  if (inputType === 'date' || inputType === 'datetime-local') {
    return dateToEpoch(value);
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : Number.NaN;
}

function getEditorInputType(editor) {
  const innerField = editor.shadowRoot?.querySelector('input, textarea, select');
  return innerField?.type || editor.type || editor.getAttribute?.('type') || 'text';
}

function getEditorDatatype(editor) {
  return editor.shaclDatatype?.value || editor.shaclDatatype?.id || editor.getAttribute?.('datatype') || '';
}

function getRangeInputType(editor) {
  const inputType = getEditorInputType(editor);
  const datatype = getEditorDatatype(editor);

  if (inputType === 'date' || datatype.endsWith('#date')) {
    return 'date';
  }

  if (inputType === 'datetime-local' || datatype.endsWith('#dateTime')) {
    return 'datetime-local';
  }

  return inputType;
}

function isRangeEditor(editor) {
  const inputType = getEditorInputType(editor);
  const datatype = getEditorDatatype(editor);

  return (
    ['number', 'date', 'datetime-local'].includes(inputType) ||
    ['#integer', '#float', '#double', '#decimal', '#date', '#dateTime'].some((suffix) =>
      datatype.endsWith(suffix),
    )
  );
}

function FileTable({ apiKey, files, isLoading, onSelectFile, resource, selectedFilePath }) {
  return (
    <section className="files-panel">
      <div className="panel-title">
        <h3>Files</h3>
        {isLoading ? <span>Loading...</span> : <span>{files.length}</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {files.length ? (
              files.map((file, index) => (
                <tr
                  className={selectedFilePath === filePath(file) ? 'selected-file-row' : ''}
                  key={`${file.path}-${index}`}
                  onClick={() => onSelectFile(file)}
                >
                  <td>{file.path || file.name || 'Untitled file'}</td>
                  <td>
                    <button
                      className="download-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadFile({ apiKey, file, resource });
                      }}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-cell" colSpan="2">
                  {isLoading ? 'Loading files...' : 'No files match the current metadata filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed.');
  }

  return payload;
}

async function downloadFile({ apiKey, file, resource }) {
  const path = filePath(file);
  const response = await fetch('/api/coscine/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      projectId: resource.projectId,
      resourceId: resource.resourceId,
      path,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    window.alert(payload.message || 'Could not download file.');
    return;
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = path.split('/').pop() || 'download';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function filterFiles(files, filterRdf) {
  const filters = parseFieldFilters(filterRdf);

  if (!filters.length) {
    return files;
  }

  return files.filter((file) => {
    const metadataValues = extractTextMetadataValueMap(file.metadata);
    const haystack = `${file.path ?? ''}\n${JSON.stringify(file.metadata ?? '')}`.toLowerCase();

    return filters.every(({ path, value }) => {
      if (!path) {
        return haystack.includes(value);
      }

      const values = metadataValues.get(path) ?? [];

      if (!values.length) {
        // Missing predicate means this filter is not applicable to the file.
        return true;
      }

      return values.some((metadataValue) => metadataValue.includes(value));
    });
  });
}

function normalizeSerializedFilter(serializedRdf) {
  return serializedRdf || '';
}

function parseFieldFilters(filterText) {
  if (!filterText) {
    return [];
  }

  try {
    const parsed = JSON.parse(filterText);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry) => entry?.path && entry?.value !== undefined)
        .map((entry) => ({
          path: entry.path,
          value: String(entry.value).trim().toLowerCase(),
        }))
        .filter((entry) => entry.value !== '');
    }
  } catch {
    return extractFilterTerms(filterText).map((term) => ({ path: null, value: term }));
  }

  return [];
}

function collectFormFilterText(formElement) {
  const root = formElement.shadowRoot ?? formElement;
  const values = Array.from(root.querySelectorAll('.property-instance[data-path] .editor'))
    .filter((editor) => !isRangeEditor(editor))
    .map((editor) => {
      const path = editor.closest('.property-instance[data-path]')?.dataset.path;
      const value = getEditorCurrentValue(editor);
      return path && value !== '' ? { path, value } : null;
    })
    .filter(Boolean);

  return JSON.stringify(values);
}

function getEditorCurrentValue(editor) {
  const innerField = editor.shadowRoot?.querySelector('input, textarea, select');
  const field = innerField ?? editor;

  if (field.type === 'checkbox') {
    return field.checked ? 'true' : '';
  }

  return String(field.value ?? editor.value ?? editor.dataset?.value ?? '').trim();
}

function applyRangeFilters(files, filters) {
  const activeFilters = Object.entries(filters);

  if (!activeFilters.length) {
    return files;
  }

  return files.filter((file) => {
    const valueMap = extractRangeMetadataValueMap(file.metadata);

    return activeFilters.every(([path, [min, max]]) => {
      const values = valueMap.get(path) ?? [];

      if (!values.length) {
        // Missing predicate means this range filter is not applicable to the file.
        return true;
      }

      return values.some((value) => Number.isFinite(value) && value >= min && value <= max);
    });
  });
}

function extractTextMetadataValueMap(metadata) {
  const json = extractJsonLdMetadata(metadata);
  const valueMap = new Map();

  if (!json) {
    return valueMap;
  }

  const nodes = Array.isArray(json) ? json : [json];

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      continue;
    }

    for (const [predicate, rawValues] of Object.entries(node)) {
      if (predicate.startsWith('@')) {
        continue;
      }

      const values = Array.isArray(rawValues) ? rawValues : [rawValues];
      for (const rawValue of values) {
        const literal = typeof rawValue === 'object' ? rawValue?.['@value'] : rawValue;
        const normalizedLiteral = String(literal ?? '').trim().toLowerCase();

        if (normalizedLiteral !== '') {
          const currentValues = valueMap.get(predicate) ?? [];
          currentValues.push(normalizedLiteral);
          valueMap.set(predicate, currentValues);
        }
      }
    }
  }

  return valueMap;
}

function extractRangeMetadataValueMap(metadata) {
  const json = extractJsonLdMetadata(metadata);
  const valueMap = new Map();

  if (!json) {
    return valueMap;
  }

  const nodes = Array.isArray(json) ? json : [json];

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      continue;
    }

    for (const [predicate, rawValues] of Object.entries(node)) {
      if (predicate.startsWith('@')) {
        continue;
      }

      const values = Array.isArray(rawValues) ? rawValues : [rawValues];
      for (const rawValue of values) {
        const literal = typeof rawValue === 'object' ? rawValue?.['@value'] : rawValue;
        const datatype = typeof rawValue === 'object' ? rawValue?.['@type'] : '';
        const rangeValue = literalToRangeValue(literal, datatype);

        if (rangeValue) {
          const currentValues = valueMap.get(predicate) ?? [];
          currentValues.push(rangeValue);
          valueMap.set(predicate, currentValues);
        }
      }
    }
  }

  return valueMap;
}

function extractJsonLdMetadata(metadata) {
  if (!metadata) {
    return null;
  }

  if (isJsonLdMetadata(metadata)) {
    return metadata;
  }

  if (typeof metadata === 'string' && /^\s*[\[{]/.test(metadata)) {
    try {
      const parsed = JSON.parse(metadata);
      return isJsonLdMetadata(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof metadata === 'object') {
    for (const key of ['content', 'metadata', 'data', 'value']) {
      const extracted = extractJsonLdMetadata(metadata[key]);
      if (extracted) {
        return extracted;
      }
    }
  }

  return null;
}

function literalToRangeValue(literal, datatype) {
  if (literal === undefined || literal === null || datatype?.includes('boolean')) {
    return Number.NaN;
  }

  const dateValue = dateToEpoch(literal);
  if (datatype?.includes('date') && Number.isFinite(dateValue)) {
    return dateValue;
  }

  const numericValue = Number(literal);
  if (Number.isFinite(numericValue) && String(literal).trim() !== '') {
    return numericValue;
  }

  if (Number.isFinite(dateValue) && /T|\d{4}-\d{2}-\d{2}/.test(String(literal))) {
    return dateValue;
  }

  return Number.NaN;
}

function dateToEpoch(value) {
  if (!value) {
    return Number.NaN;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? Number.NaN : Math.round(date.getTime() / 1000);
}

function extractFilterTerms(rdf) {
  return Array.from(
    new Set(
      String(rdf ?? '')
        .match(/"([^"\\]*(?:\\.[^"\\]*)*)"/g)
        ?.map((match) => match.slice(1, -1).trim().toLowerCase()) ?? [],
    ),
  );
}

function filePath(file) {
  if (!file) {
    return '';
  }

  return String(file.path ?? file.name ?? file.fileName ?? file.key ?? file.id ?? '');
}

function normalizeMetadataForForm(metadata, file) {
  const stableSubject = stableFileSubject(file);

  if (!metadata) {
    return { subject: stableSubject, values: '' };
  }

  if (typeof metadata === 'string') {
    return normalizeStringMetadataForForm(metadata, stableSubject);
  }

  if (isJsonLdMetadata(metadata)) {
    return normalizeJsonLdMetadataForForm(metadata, stableSubject);
  }

  for (const key of ['content', 'metadata', 'data', 'value', 'rdf', 'ttl', 'turtle']) {
    if (typeof metadata[key] === 'string' && looksLikeRdf(metadata[key])) {
      return normalizeStringMetadataForForm(metadata[key], stableSubject);
    }

    if (isJsonLdMetadata(metadata[key])) {
      return normalizeJsonLdMetadataForForm(metadata[key], stableSubject);
    }
  }

  if (typeof metadata.content === 'object') {
    return normalizeMetadataForForm(metadata.content, file);
  }

  return { subject: stableSubject, values: '' };
}

function normalizeStringMetadataForForm(metadata, stableSubject) {
  const trimmedMetadata = String(metadata ?? '').trim();

  if (!trimmedMetadata) {
    return { subject: stableSubject, values: '' };
  }

  if (/^\s*[\[{]/.test(trimmedMetadata)) {
    try {
      return normalizeJsonLdMetadataForForm(JSON.parse(trimmedMetadata), stableSubject);
    } catch {
      // Keep non-JSON RDF strings as-is.
    }
  }

  const explicitSubject = inferTurtleSubject(trimmedMetadata);
  return { subject: explicitSubject || stableSubject, values: trimmedMetadata };
}

function normalizeJsonLdMetadataForForm(metadata, stableSubject) {
  const nodes = Array.isArray(metadata) ? metadata : [metadata];
  const normalizedNodes = nodes.map((node, index) => {
    if (!node || typeof node !== 'object') {
      return node;
    }

    const currentId = node['@id'];
    const nextId =
      index === 0 && (!currentId || String(currentId).startsWith('_:')) ? stableSubject : currentId;

    return nextId ? { ...node, '@id': nextId } : node;
  });

  const subject =
    normalizedNodes.find((node) => node && typeof node === 'object' && typeof node['@id'] === 'string')?.[
      '@id'
    ] || stableSubject;

  return {
    subject,
    values: JSON.stringify(Array.isArray(metadata) ? normalizedNodes : normalizedNodes[0]),
  };
}

function inferTurtleSubject(turtle) {
  const turtleSubject = turtle.match(/(?:^|\n)\s*<([^>]+)>\s+(?:a|<|[a-zA-Z][\w-]*:|\[[\s\S]*?\])/);

  if (turtleSubject?.[1]) {
    return turtleSubject[1];
  }

  return undefined;
}

function stableFileSubject(file) {
  const path = filePath(file);
  return `urn:coscine:file:${encodeURIComponent(path || 'selected')}`;
}

function looksLikeRdf(value) {
  return /@prefix|@base|<[^>]+>\s+(?:a|<|[a-zA-Z][\w-]*:)|\{\s*"@context"/.test(value);
}

function isJsonLdMetadata(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const nodes = Array.isArray(value) ? value : [value];
  return nodes.some((node) => node && typeof node === 'object' && ('@id' in node || '@type' in node || '@context' in node));
}

function resourceKey(resource) {
  return resource ? `${resource.projectId}:${resource.resourceId}` : '';
}

function groupResourcesByProject(resources) {
  const groups = new Map();

  for (const resource of resources) {
    const projectId = resource.projectId || resource.projectName || 'unknown-project';
    if (!groups.has(projectId)) {
      groups.set(projectId, {
        id: projectId,
        name: resource.projectName || projectId,
        resources: [],
      });
    }

    groups.get(projectId).resources.push(resource);
  }

  return Array.from(groups.values());
}

function formatBytes(value) {
  const size = Number(value);
  if (!Number.isFinite(size)) {
    return '';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = size;
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return `${amount.toFixed(amount >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

createRoot(document.getElementById('root')).render(<App />);
