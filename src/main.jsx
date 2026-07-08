import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DataFactory, Parser, Writer } from 'n3';
import '@ulb-darmstadt/shacl-form';
import coscineLogo from './assets/coscine_rgb.svg';
import aimsLogo from './assets/aims_title_FHD_transparent_header.png';
import {
  COSCINE_ENVIRONMENTS,
  createCoscineService,
} from './coscineApi';
import {
  DEFAULT_PROFILE_QUERY,
  fetchAimsApplicationProfileDefinition,
  fetchAimsApplicationProfiles,
  getProfileBaseUri,
} from './aimsApi';
import './styles.css';

const FORM_MEMORY_STORAGE_KEY = 'coscine-upload:form-memory:v1';
const DCTERMS_CONFORMS_TO = 'http://purl.org/dc/terms/conformsTo';
const DCTERMS_DESCRIPTION = 'http://purl.org/dc/terms/description';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const SH_NODE_SHAPE = 'http://www.w3.org/ns/shacl#NodeShape';
const SH_PATH = 'http://www.w3.org/ns/shacl#path';
const SH_PROPERTY = 'http://www.w3.org/ns/shacl#property';
const SH_NAME = 'http://www.w3.org/ns/shacl#name';
const SH_DESCRIPTION = 'http://www.w3.org/ns/shacl#description';
const SH_QUALIFIED_VALUE_SHAPE = 'http://www.w3.org/ns/shacl#qualifiedValueShape';
const SH_TARGET_CLASS = 'http://www.w3.org/ns/shacl#targetClass';
const SH_MIN_COUNT = 'http://www.w3.org/ns/shacl#minCount';
const SH_MIN_LENGTH = 'http://www.w3.org/ns/shacl#minLength';
const SH_DEFAULT_VALUE = 'http://www.w3.org/ns/shacl#defaultValue';
const SH_MIN_LENGTH_CONSTRAINT = 'http://www.w3.org/ns/shacl#MinLengthConstraintComponent';
const SH_MIN_COUNT_CONSTRAINT = 'http://www.w3.org/ns/shacl#MinCountConstraintComponent';
const SH_QUALIFIED_MIN_COUNT_CONSTRAINT = 'http://www.w3.org/ns/shacl#QualifiedMinCountConstraintComponent';
const OWL_IMPORTS = 'http://www.w3.org/2002/07/owl#imports';
const { literal, namedNode, quad } = DataFactory;
const GLOBAL_LANGUAGE_OPTIONS = [
  {
    value: 'en',
    label: 'English',
    iconSrc: 'https://unpkg.com/language-icons/icons/en.svg',
  },
  {
    value: 'de',
    label: 'Deutsch',
    iconSrc: 'https://unpkg.com/language-icons/icons/de.svg',
  },
];
const APP_TEXT = {
  en: {
    aims: 'AIMS',
    apiTokenPlaceholder: 'Coscine API token',
    browserMemory: 'Browser memory',
    clear: 'Clear',
    clearSavedValues: 'Clear saved values',
    coscinePath: 'Coscine path',
    createResource: 'Create resource',
    createResourceHint: 'Define a test resource from a local SHACL file or AIMS.',
    createTestResource: 'Create test resource',
    creating: 'Creating...',
    environment: 'Environment',
    file: 'File',
    loadFile: 'Load file',
    loadResources: 'Load resources',
    loading: 'Loading...',
    loadingShaclForm: 'Loading SHACL form...',
    localFile: 'Local file',
    mainViews: 'Main views',
    metadataForm: 'Metadata form',
    metadataProfileSource: 'Metadata profile source',
    noFileLoaded: 'No file loaded',
    productionEnvironment: 'Production environment',
    ready: 'Ready',
    delete: 'Delete',
    download: 'Download',
    files: 'Files',
    pending: 'Pending',
    refresh: 'Refresh',
    requiredMetadata: 'Required metadata',
    resourceName: 'Resource name',
    search: 'Search',
    searchProfiles: 'Search profiles',
    searchResources: 'Search resources',
    resizeFormAndFiles: 'Resize form and files',
    searching: 'Searching...',
    selectedFile: 'Selected file',
    shaclFormFile: 'SHACL form file',
    tabSearch: 'Search',
    tabUpload: 'Hochladen',
    tabView: 'View',
    testEnvironment: 'Test environment',
    tokenNotUsedPlaceholder: 'Token not used in test mode',
    uploadFile: 'Upload file to Coscine',
    uploading: 'Uploading...',
    useMemoryCheckbox: 'Use the checkbox on a metadata field to remember its value in this browser.',
  },
  de: {
    aims: 'AIMS',
    apiTokenPlaceholder: 'Coscine-API-Token',
    browserMemory: 'Browser-Speicher',
    clear: 'Leeren',
    clearSavedValues: 'Gespeicherte Werte loeschen',
    coscinePath: 'Coscine-Pfad',
    createResource: 'Ressource erstellen',
    createResourceHint: 'Definiere eine Testressource aus einer lokalen SHACL-Datei oder AIMS.',
    createTestResource: 'Testressource erstellen',
    creating: 'Wird erstellt...',
    environment: 'Umgebung',
    file: 'Datei',
    loadFile: 'Datei laden',
    loadResources: 'Ressourcen laden',
    loading: 'Wird geladen...',
    loadingShaclForm: 'SHACL-Formular wird geladen...',
    localFile: 'Lokale Datei',
    mainViews: 'Hauptansichten',
    metadataForm: 'Metadatenformular',
    metadataProfileSource: 'Metadatenprofil-Quelle',
    noFileLoaded: 'Keine Datei geladen',
    productionEnvironment: 'Produktionsumgebung',
    ready: 'Bereit',
    delete: 'Loeschen',
    download: 'Herunterladen',
    files: 'Dateien',
    pending: 'Ausstehend',
    refresh: 'Aktualisieren',
    requiredMetadata: 'Erforderliche Metadaten',
    resourceName: 'Ressourcenname',
    search: 'Suchen',
    searchProfiles: 'Profile suchen',
    searchResources: 'Ressourcen suchen',
    resizeFormAndFiles: 'Formular und Dateien skalieren',
    searching: 'Suche...',
    selectedFile: 'Ausgewaehlte Datei',
    shaclFormFile: 'SHACL-Formulardatei',
    tabSearch: 'Suche',
    tabUpload: 'Upload',
    tabView: 'Ansicht',
    testEnvironment: 'Testumgebung',
    tokenNotUsedPlaceholder: 'Token wird im Testmodus nicht verwendet',
    uploadFile: 'Datei nach Coscine hochladen',
    uploading: 'Wird hochgeladen...',
    useMemoryCheckbox: 'Nutze die Checkbox am Metadatenfeld, um den Wert in diesem Browser zu merken.',
  },
};
const AppTextContext = createContext(APP_TEXT.en);

function useAppText() {
  return useContext(AppTextContext);
}

function App() {
  const [apiToken, setApiToken] = useState('');
  const [coscineEnvironment, setCoscineEnvironment] = useState(COSCINE_ENVIRONMENTS.REAL);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [activeTab, setActiveTab] = useState('upload');
  const [resourceSearchText, setResourceSearchText] = useState('');
  const [searchResourceKey, setSearchResourceKey] = useState('');
  const [searchResourceDetails, setSearchResourceDetails] = useState(null);
  const [searchProfile, setSearchProfile] = useState(null);
  const [, setSearchFilterRdf] = useState('');
  const [searchRangeFilters, setSearchRangeFilters] = useState({});
  const [isLoadingSearchSelection, setIsLoadingSearchSelection] = useState(false);
  const [projectsCount, setProjectsCount] = useState(0);
  const [resources, setResources] = useState([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [profile, setProfile] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [targetPath, setTargetPath] = useState('');
  const [metadataContent, setMetadataContent] = useState('');
  const [metadataValid, setMetadataValid] = useState(false);
  const [metadataValidationSummary, setMetadataValidationSummary] = useState('');
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceSource, setNewResourceSource] = useState('file');
  const [newResourceShaclFile, setNewResourceShaclFile] = useState(null);
  const [profileSearchText, setProfileSearchText] = useState(DEFAULT_PROFILE_QUERY);
  const [metadataProfiles, setMetadataProfiles] = useState([]);
  const [selectedMetadataProfile, setSelectedMetadataProfile] = useState(null);
  const [profileSearchStatus, setProfileSearchStatus] = useState('');
  const [profileSearchError, setProfileSearchError] = useState('');
  const [isSearchingProfiles, setIsSearchingProfiles] = useState(false);
  const [isLoadingMetadataProfile, setIsLoadingMetadataProfile] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isLoadingResources, setIsLoadingResources] = useState(false);
  const [isCreatingResource, setIsCreatingResource] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [virtualResources, setVirtualResources] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [formMemoryFields, setFormMemoryFields] = useState([]);
  const [rememberedFieldPaths, setRememberedFieldPaths] = useState([]);
  const metadataFormRef = useRef(null);
  const newResourceFileInputRef = useRef(null);
  const coscineService = useMemo(() => createCoscineService(coscineEnvironment), [coscineEnvironment]);
  const text = APP_TEXT[selectedLanguage] ?? APP_TEXT.en;
  const canLoadResources = !isLoadingResources && (!coscineService.tokenRequired || Boolean(apiToken.trim()));
  const isTestEnvironment = coscineEnvironment === COSCINE_ENVIRONMENTS.TEST;

  useEffect(() => {
    document.documentElement.lang = selectedLanguage;
  }, [selectedLanguage]);

  const selectedResource = useMemo(
    () => resources.find((resource) => resourceKey(resource) === selectedKey) ?? null,
    [resources, selectedKey],
  );
  const selectedSearchResource = useMemo(
    () => resources.find((resource) => resourceKey(resource) === searchResourceKey) ?? null,
    [resources, searchResourceKey],
  );

  useEffect(() => {
    setProjectsCount(0);
    setResources([]);
    setSelectedKey('');
    setSearchResourceKey('');
    setSearchResourceDetails(null);
    setSearchProfile(null);
    setSearchFilterRdf('');
    setSearchRangeFilters({});
    setProfile(null);
    setSelectedFile(null);
    setTargetPath('');
    setMetadataContent('');
    setMetadataValid(false);
    setMetadataValidationSummary('');
    setNewResourceName('');
    setNewResourceSource('file');
    setNewResourceShaclFile(null);
    setProfileSearchText(DEFAULT_PROFILE_QUERY);
    setMetadataProfiles([]);
    setSelectedMetadataProfile(null);
    setProfileSearchStatus('');
    setProfileSearchError('');
    setVirtualResources([]);
    setUploadedFiles([]);
    setError('');
    setStatus(
      coscineService.environment === COSCINE_ENVIRONMENTS.TEST
        ? 'Test environment selected. Resources and uploads are stored locally in this browser.'
        : '',
    );
  }, [coscineService]);

  useEffect(() => {
    if (isTestEnvironment && activeTab === 'search') {
      setActiveTab('upload');
      return;
    }

    if (!isTestEnvironment && activeTab === 'view') {
      setActiveTab('search');
    }
  }, [activeTab, isTestEnvironment]);

  async function loadResources(event) {
    event.preventDefault();
    setError('');
    setStatus(`Loading ${coscineService.label} resources...`);
    setProjectsCount(0);
    setResources([]);
    setSelectedKey('');
    setSearchResourceKey('');
    setSearchResourceDetails(null);
    setSearchProfile(null);
    setSearchFilterRdf('');
    setSearchRangeFilters({});
    setProfile(null);
    setMetadataContent('');
    setMetadataValid(false);
    setMetadataValidationSummary('');
    setNewResourceName('');
    setNewResourceShaclFile(null);
    setSelectedMetadataProfile(null);
    setProfileSearchError('');
    setVirtualResources([]);
    setUploadedFiles([]);
    setIsLoadingResources(true);

    try {
      const payload = await coscineService.fetchResourceOptions(apiToken);
      setProjectsCount(payload.projects);
      setResources(payload.resources);
      setStatus(
        payload.resources.length
          ? `Select a resource, choose a file, then fill the required Coscine metadata. Using ${coscineService.label}.`
          : isTestEnvironment
            ? 'Create a test resource from a SHACL form file.'
          : 'No resources returned for this API token.',
      );
      await refreshTestViewData();
    } catch (loadError) {
      setError(loadError.message || 'Could not load Coscine resources.');
      setStatus('');
    } finally {
      setIsLoadingResources(false);
    }
  }

  useEffect(() => {
    if ((!apiToken.trim() && coscineService.tokenRequired) || !selectedResource) {
      return undefined;
    }

    let isActive = true;
    setError('');
    setProfile(null);
    setMetadataContent('');
    setMetadataValid(false);
    setMetadataValidationSummary('');
    setIsLoadingProfile(true);
    setStatus('Loading application profile...');

    coscineService.fetchApplicationProfileDefinition(apiToken, selectedResource.applicationProfileUri)
      .then((loadedProfile) => {
        if (!isActive) {
          return;
        }

        setProfile(loadedProfile);
        setStatus(`Resource ready in ${coscineService.label}. Choose the file to upload and fill the metadata.`);
      })
      .catch((profileError) => {
        if (!isActive) {
          return;
        }

        setError(profileError.message || 'Could not load the selected resource form.');
        setStatus('');
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [apiToken, coscineService, selectedResource]);

  useEffect(() => {
    if (
      activeTab !== 'search' ||
      isTestEnvironment ||
      !apiToken.trim() ||
      !selectedSearchResource ||
      typeof coscineService.fetchResourceDetails !== 'function'
    ) {
      return undefined;
    }

    let isActive = true;
    setError('');
    setStatus('Loading selected resource files...');
    setSearchResourceDetails(null);
    setSearchProfile(null);
    setSearchFilterRdf('');
    setSearchRangeFilters({});
    setIsLoadingSearchSelection(true);

    const detailsRequest = coscineService.fetchResourceDetails(apiToken, {
      projectId: selectedSearchResource.projectId,
      resourceId: selectedSearchResource.resourceId,
    });
    const profileRequest = selectedSearchResource.applicationProfileUri
      ? coscineService.fetchApplicationProfileDefinition(apiToken, selectedSearchResource.applicationProfileUri)
          .catch((profileError) => ({ profileError }))
      : Promise.resolve(null);

    Promise.all([detailsRequest, profileRequest])
      .then(([details, loadedProfile]) => {
        if (!isActive) {
          return;
        }

        setSearchResourceDetails(details);
        setSearchProfile(loadedProfile?.profileError ? null : loadedProfile);
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
          setIsLoadingSearchSelection(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [activeTab, apiToken, coscineService, isTestEnvironment, selectedSearchResource]);

  async function uploadToCoscine() {
    setError('');
    setStatus('Preparing Coscine metadata...');
    setIsUploading(true);

    try {
      if (typeof metadataFormRef.current?.serialize !== 'function') {
        throw new Error('The Coscine metadata form is not ready yet.');
      }

      if (typeof metadataFormRef.current?.validate === 'function') {
        const validationReport = await metadataFormRef.current.validate(false);

        if (!validationReport?.conforms) {
          setMetadataValid(false);
          const validationSummary = formatValidationReport(metadataFormRef.current, validationReport);
          setMetadataValidationSummary(validationSummary);
          throw new Error(validationSummary || 'Complete the required Coscine metadata before uploading.');
        }
      }

      const serializedMetadata = metadataFormRef.current.serialize();

      if (!String(serializedMetadata ?? '').trim()) {
        throw new Error('Fill the required Coscine metadata before uploading.');
      }

      setMetadataContent(serializedMetadata);
      setMetadataValid(true);
      setMetadataValidationSummary('');
      saveRememberedFormFields({
        contextKey: getFormMemoryContextKey(profile, selectedResource),
        fieldPaths: rememberedFieldPaths,
        fields: formMemoryFields,
        metadataContent: serializedMetadata,
        profile,
      });
      setStatus(`Uploading selected file and metadata to ${coscineService.label}...`);

      await coscineService.uploadFile({
        apiToken,
        projectId: selectedResource?.projectId,
        resourceId: selectedResource?.resourceId,
        file: selectedFile,
        fileName: targetPath || selectedFile?.name,
        metadataContent: serializedMetadata,
        profile,
      });
      setStatus(`Uploaded ${targetPath || selectedFile.name} to ${coscineService.label}.`);
      await refreshTestViewData();
    } catch (uploadError) {
      setError(uploadError.message || 'Could not upload to Coscine.');
      setStatus('');
    } finally {
      setIsUploading(false);
    }
  }

  async function createTestResource(event) {
    event.preventDefault();
    setError('');
    setStatus('Creating test resource...');
    setIsCreatingResource(true);

    try {
      const profileDefinition = selectedMetadataProfile?.definition ?? null;
      const usesProfileService = newResourceSource === 'profile';
      const shaclFileName = usesProfileService
        ? `${resourceNameFromFileName(profileDefinition?.name || 'metadata-profile')}.ttl`
        : newResourceShaclFile?.name;

      if (!usesProfileService && !newResourceShaclFile) {
        throw new Error('Choose a SHACL form file.');
      }

      if (usesProfileService && !profileDefinition?.shapes) {
        throw new Error('Select a metadata profile from the service.');
      }

      const shaclContent = usesProfileService ? profileDefinition.shapes : await newResourceShaclFile.text();
      const resourceName =
        newResourceName.trim() ||
        (usesProfileService
          ? selectedMetadataProfile?.name || profileDefinition.name || profileDefinition.baseUri || 'Metadata profile'
          : resourceNameFromFileName(newResourceShaclFile.name));
      const createdResource = await coscineService.createResource({
        name: resourceName,
        shaclFileName,
        shaclContent,
      });

      setResources((currentResources) => [...currentResources, createdResource]);
      setSelectedKey(resourceKey(createdResource));
      setStatus(`Created ${createdResource.resourceName} in ${coscineService.label}.`);
      setNewResourceName('');
      setNewResourceShaclFile(null);
      setSelectedMetadataProfile(null);
      await refreshTestViewData();
    } catch (createError) {
      setError(createError.message || 'Could not create the test resource.');
      setStatus('');
    } finally {
      setIsCreatingResource(false);
    }
  }

  async function searchMetadataProfiles(event) {
    event.preventDefault();
    const trimmedQuery = profileSearchText.trim();

    if (!trimmedQuery) {
      setMetadataProfiles([]);
      setProfileSearchStatus('Enter a search string.');
      setProfileSearchError('');
      return;
    }

    setIsSearchingProfiles(true);
    setProfileSearchError('');
    setProfileSearchStatus('Searching metadata profiles...');

    try {
      const profiles = await fetchAimsApplicationProfiles({ query: trimmedQuery });
      setMetadataProfiles(profiles);
      setProfileSearchStatus(
        profiles.length === 1
          ? '1 metadata profile found.'
          : `${profiles.length} metadata profiles found.`,
      );
    } catch (searchError) {
      setMetadataProfiles([]);
      setProfileSearchStatus('');
      setProfileSearchError(searchError?.message || 'Unable to search metadata profiles.');
    } finally {
      setIsSearchingProfiles(false);
    }
  }

  async function selectMetadataProfile(profile) {
    setIsLoadingMetadataProfile(true);
    setProfileSearchError('');

    try {
      const definition = await fetchAimsApplicationProfileDefinition({ profile });
      setSelectedMetadataProfile({
        baseUri: getProfileBaseUri(profile),
        definition,
        name: profile.name || definition.name || 'Metadata profile',
      });
      setNewResourceName(profile.name || definition.name || getProfileBaseUri(profile) || 'Metadata profile');
      setProfileSearchStatus(`Loaded ${definition.name}.`);
    } catch (selectError) {
      setProfileSearchError(selectError?.message || 'Unable to load selected metadata profile.');
    } finally {
      setIsLoadingMetadataProfile(false);
    }
  }

  async function refreshTestViewData() {
    if (!isTestEnvironment || typeof coscineService.getViewData !== 'function') {
      return;
    }

    const snapshot = await coscineService.getViewData();
    setVirtualResources(snapshot.resources ?? []);
    setUploadedFiles(snapshot.uploads ?? []);
  }

  async function deleteTestResource(resource) {
    if (!isTestEnvironment || typeof coscineService.deleteResource !== 'function') {
      return;
    }

    setError('');
    setStatus(`Deleting ${resource.resourceName || resource.resourceId}...`);

    try {
      await coscineService.deleteResource({
        projectId: resource.projectId,
        resourceId: resource.resourceId,
      });
      setResources((currentResources) =>
        currentResources.filter((item) => item.projectId !== resource.projectId || item.resourceId !== resource.resourceId),
      );
      if (selectedKey === resourceKey(resource)) {
        setSelectedKey('');
        setProfile(null);
        setSelectedFile(null);
        setTargetPath('');
        setMetadataContent('');
        setMetadataValid(false);
        setMetadataValidationSummary('');
      }
      setStatus(`Deleted ${resource.resourceName || resource.resourceId} and its uploaded files.`);
      await refreshTestViewData();
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete the test resource.');
      setStatus('');
    }
  }

  async function deleteTestUpload(file) {
    if (!isTestEnvironment || typeof coscineService.deleteUploadedFile !== 'function') {
      return;
    }

    setError('');
    setStatus(`Deleting ${file.fileName || file.storageKey}...`);

    try {
      await coscineService.deleteUploadedFile({ storageKey: file.storageKey });
      setStatus(`Deleted ${file.fileName || file.storageKey}.`);
      await refreshTestViewData();
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete the uploaded file.');
      setStatus('');
    }
  }

  useEffect(() => {
    if (activeTab !== 'view' || !isTestEnvironment) {
      return undefined;
    }

    let isActive = true;
    refreshTestViewData().catch((viewError) => {
      if (!isActive) {
        return;
      }

      setError(viewError.message || 'Could not load the test view.');
      setStatus('');
    });

    return () => {
      isActive = false;
    };
  }, [activeTab, coscineService, isTestEnvironment]);

  return (
    <AppTextContext.Provider value={text}>
    <main className="app-shell">
      <LanguageSelector
        language={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />

      <header className="top-bar">
        <div className="brand-block">
          <img src={coscineLogo} alt="Coscine" className="coscine-logo" />
          <div>
            <p className="eyebrow">RWTH Coscine</p>
            <h1>Client</h1>
          </div>
        </div>

        <form className="token-form" onSubmit={loadResources}>
          <label className="environment-field">
            <span>{text.environment}</span>
            <select
              value={coscineEnvironment}
              onChange={(event) => setCoscineEnvironment(event.target.value)}
            >
              <option value={COSCINE_ENVIRONMENTS.REAL}>{text.productionEnvironment}</option>
              <option value={COSCINE_ENVIRONMENTS.TEST}>{text.testEnvironment}</option>
            </select>
          </label>
          <input
            type="password"
            value={apiToken}
            placeholder={coscineService.tokenRequired ? text.apiTokenPlaceholder : text.tokenNotUsedPlaceholder}
            autoComplete="off"
            disabled={!coscineService.tokenRequired}
            onChange={(event) => setApiToken(event.target.value)}
          />
          <button type="submit" disabled={!canLoadResources}>
            {isLoadingResources ? text.loading : text.loadResources}
          </button>
        </form>
      </header>

      <nav className="tab-bar" aria-label={text.mainViews}>
        <button
          type="button"
          className={activeTab === 'upload' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('upload')}
        >
          {text.tabUpload}
        </button>
        <button
          type="button"
          className={
            activeTab === 'view' && isTestEnvironment ? 'tab-button active' : 'tab-button'
          }
          hidden={!isTestEnvironment}
          onClick={() => setActiveTab('view')}
        >
          {text.tabView}
        </button>
        <button
          type="button"
          className={activeTab === 'search' && !isTestEnvironment ? 'tab-button active' : 'tab-button'}
          hidden={isTestEnvironment}
          onClick={() => setActiveTab('search')}
        >
          {text.tabSearch}
        </button>
      </nav>

      {error ? <div className="alert">{error}</div> : null}
      {status ? <div className="status-line">{status}</div> : null}

      {activeTab === 'upload' ? (
        <section className="content-grid">
          <aside className="resource-list">
            {isTestEnvironment ? (
              <section className="create-resource-panel">
                  <div className="panel-title">
                    <div>
                      <h3>{text.createResource}</h3>
                      <p>{text.createResourceHint}</p>
                    </div>
                  </div>

                <form className="create-resource-form" onSubmit={createTestResource}>
                  <div
                    className={
                      newResourceSource === 'profile'
                        ? 'source-toggle source-toggle-profile'
                        : 'source-toggle source-toggle-file'
                    }
                    aria-label={text.metadataProfileSource}
                    role="group"
                  >
                    <button
                      type="button"
                      className={newResourceSource === 'file' ? 'source-toggle-button active' : 'source-toggle-button'}
                      onClick={() => setNewResourceSource('file')}
                    >
                      {text.localFile}
                    </button>
                    <button
                      type="button"
                      className={newResourceSource === 'profile' ? 'source-toggle-button active' : 'source-toggle-button'}
                      onClick={() => setNewResourceSource('profile')}
                    >
                      {text.aims}
                    </button>
                  </div>

                  <label className="field-label">
                    {text.resourceName}
                    <input
                      value={newResourceName}
                      placeholder="Example resource"
                      onChange={(event) => setNewResourceName(event.target.value)}
                    />
                  </label>

                  {newResourceSource === 'file' ? (
                    <div className="field-label">
                      {text.shaclFormFile}
                      <div className="file-load-row">
                        <input
                          ref={newResourceFileInputRef}
                          className="visually-hidden-input"
                          type="file"
                          accept=".ttl,.txt,.rdf,.jsonld,.json"
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            setNewResourceShaclFile(file);

                            if (file) {
                              setNewResourceName(resourceNameFromFileName(file.name));
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="load-file-button"
                          onClick={() => newResourceFileInputRef.current?.click()}
                        >
                          {text.loadFile}
                        </button>
                        <span>{newResourceShaclFile?.name || text.noFileLoaded}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="profile-service-panel">
                      <div className="aims-brand">
                        <img src={aimsLogo} alt="AIMS" />
                      </div>

                      <div className="field-label">
                        {text.searchProfiles}
                        <div className="profile-search-row">
                          <input
                            type="search"
                            value={profileSearchText}
                            placeholder="RO-kit"
                            onChange={(event) => setProfileSearchText(event.target.value)}
                          />
                          <button type="button" onClick={searchMetadataProfiles} disabled={isSearchingProfiles}>
                            {isSearchingProfiles ? text.searching : text.search}
                          </button>
                        </div>
                      </div>

                      {profileSearchStatus ? <p className="profile-service-status">{profileSearchStatus}</p> : null}
                      {profileSearchError ? <p className="profile-service-error">{profileSearchError}</p> : null}

                      <div className="profile-results" aria-label="Metadata profiles">
                        {metadataProfiles.length ? (
                          metadataProfiles.map((profile, index) => {
                            const baseUri = getProfileBaseUri(profile);
                            const isSelected =
                              selectedMetadataProfile?.baseUri &&
                              selectedMetadataProfile.baseUri === baseUri;

                            return (
                              <button
                                className={isSelected ? 'profile-result active' : 'profile-result'}
                                key={`${profile.name || 'profile'}-${baseUri || index}`}
                                type="button"
                                title={baseUri || undefined}
                                disabled={isLoadingMetadataProfile}
                                onClick={() => selectMetadataProfile(profile)}
                              >
                                <strong>{profile.name || 'Unnamed metadata profile'}</strong>
                                <small>{baseUri || 'No base URI'}</small>
                              </button>
                            );
                          })
                        ) : (
                          <p className="profile-service-empty">No metadata profiles listed.</p>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    className="primary-action secondary-action"
                    type="submit"
                    disabled={
                      isCreatingResource ||
                      !newResourceName.trim() ||
                      (newResourceSource === 'file'
                        ? !newResourceShaclFile
                        : !selectedMetadataProfile?.definition?.shapes)
                    }
                  >
                    {isCreatingResource ? text.creating : text.createTestResource}
                  </button>
                </form>
              </section>
            ) : null}

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
              <div className="empty-state">
                {coscineService.tokenRequired
                  ? 'Enter an API token and load resources.'
                  : 'Load test resources from the emulator.'}
              </div>
            )}
          </aside>

          <section className="details-panel">
            {selectedResource ? (
              <UploadWorkspace
                isLoadingProfile={isLoadingProfile}
                isUploading={isUploading}
                metadataFormRef={metadataFormRef}
                metadataValid={metadataValid}
                metadataValidationSummary={metadataValidationSummary}
                profile={profile}
                resource={selectedResource}
                selectedLanguage={selectedLanguage}
                serviceLabel={coscineService.label}
                selectedFile={selectedFile}
                targetPath={targetPath}
                onFileChange={(file) => {
                  setSelectedFile(file);
                  setTargetPath(file?.name || '');
                }}
                onMetadataChange={setMetadataContent}
                onMetadataValidChange={setMetadataValid}
                onMetadataValidationSummaryChange={setMetadataValidationSummary}
                onRememberedFieldPathsChange={setRememberedFieldPaths}
                onRememberedFieldsChange={setFormMemoryFields}
                onTargetPathChange={setTargetPath}
                onUpload={uploadToCoscine}
                rememberedFieldPaths={rememberedFieldPaths}
              />
            ) : (
              <div className="empty-state">Select a resource to prepare a file upload.</div>
            )}
          </section>
        </section>
      ) : activeTab === 'search' ? (
        <SearchView
          apiToken={apiToken}
          isLoadingSelection={isLoadingSearchSelection}
          profile={searchProfile}
          selectedLanguage={selectedLanguage}
          rangeFilters={searchRangeFilters}
          resourceDetails={searchResourceDetails}
          resources={resources}
          searchText={resourceSearchText}
          selectedResource={selectedSearchResource}
          selectedResourceKey={searchResourceKey}
          service={coscineService}
          onFilterRdfChange={setSearchFilterRdf}
          onRangeFiltersChange={setSearchRangeFilters}
          onSearchTextChange={setResourceSearchText}
          onSelectResource={(resource) => setSearchResourceKey(resourceKey(resource))}
        />
      ) : (
        <TestEnvironmentView
          isEnabled={isTestEnvironment}
          resources={virtualResources}
          uploadedFiles={uploadedFiles}
          onDeleteResource={deleteTestResource}
          onDeleteUpload={deleteTestUpload}
          onRefresh={refreshTestViewData}
        />
      )}
    </main>
    </AppTextContext.Provider>
  );
}

function LanguageSelector({ language, onLanguageChange }) {
  return (
    <div className="global-language-selector" aria-label="Global language selection">
      {GLOBAL_LANGUAGE_OPTIONS.map((option) => (
        <button
          type="button"
          className={
            language === option.value
              ? 'global-language-selector__button selected'
              : 'global-language-selector__button'
          }
          key={option.value}
          onClick={() => onLanguageChange(option.value)}
          aria-pressed={language === option.value}
          aria-label={option.label}
          title={option.label}
        >
          <img
            className="global-language-selector__icon"
            src={option.iconSrc}
            alt=""
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

function SearchView({
  apiToken,
  isLoadingSelection,
  onFilterRdfChange,
  onRangeFiltersChange,
  onSearchTextChange,
  onSelectResource,
  profile,
  rangeFilters,
  resourceDetails,
  resources,
  searchText,
  selectedLanguage,
  selectedResource,
  selectedResourceKey,
  service,
}) {
  const text = useAppText();
  const normalizedSearch = searchText.trim().toLowerCase();
  const matchingResources = normalizedSearch
    ? resources.filter((resource) =>
        [
          resource.projectName,
          resource.resourceName,
          resource.resourceType,
          resource.applicationProfileUri,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      )
    : resources;
  const files = resourceDetails?.files ?? [];
  const [localFilterRdf, setLocalFilterRdf] = useState('');
  const filteredFiles = useMemo(
    () => applyRangeFilters(filterFiles(files, localFilterRdf), rangeFilters),
    [files, localFilterRdf, rangeFilters],
  );

  const handleFilterRdfChange = useCallback((value) => {
    setLocalFilterRdf(value);
    onFilterRdfChange(value);
  }, [onFilterRdfChange]);

  return (
    <>
      <section className="content-grid search-content-grid">
        <aside className="resource-list search-resource-list">
          <div className="search-list-head">
            <label className="field-label">
              {text.searchResources}
              <input
                type="search"
                value={searchText}
                placeholder="Resource, project, type, or profile URI"
                onChange={(event) => onSearchTextChange(event.target.value)}
              />
            </label>
          </div>

          {resources.length ? (
            matchingResources.length ? (
              groupResourcesByProject(matchingResources).map((project) => (
                <div className="project-group" key={project.id}>
                  <div className="project-heading">
                    <strong>{project.name}</strong>
                    <span>{project.resources.length}</span>
                  </div>
                  {project.resources.map((resource) => (
                    <button
                      className={selectedResourceKey === resourceKey(resource) ? 'resource-row active' : 'resource-row'}
                      key={resourceKey(resource)}
                      type="button"
                      onClick={() => onSelectResource(resource)}
                    >
                      <strong>{resource.resourceName}</strong>
                      <small>{resource.resourceType || 'Resource'}</small>
                    </button>
                  ))}
                </div>
              ))
            ) : (
              <div className="empty-state">No resources match this search.</div>
            )
          ) : (
            <div className="empty-state">Load production resources before searching.</div>
          )}
        </aside>

        <section className="details-panel">
          {selectedResource ? (
            <SearchResourceWorkspace
              apiToken={apiToken}
              files={filteredFiles}
              isLoading={isLoadingSelection}
              onFilterRdfChange={handleFilterRdfChange}
              onRangeFiltersChange={onRangeFiltersChange}
              profile={profile}
              rangeFilters={rangeFilters}
              rawFiles={files}
              resource={selectedResource}
              selectedLanguage={selectedLanguage}
              service={service}
            />
          ) : (
            <div className="empty-state">Select a resource to load files and its SHACL form.</div>
          )}
        </section>
      </section>
    </>
  );
}

function SearchResourceWorkspace({
  apiToken,
  files,
  isLoading,
  onFilterRdfChange,
  onRangeFiltersChange,
  profile,
  rawFiles,
  resource,
  selectedLanguage,
  service,
}) {
  const [selectedFilePath, setSelectedFilePath] = useState('');
  const [formWidth, setFormWidth] = useState(58);
  const selectedFile = useMemo(
    () => rawFiles.find((file) => searchFilePath(file) === selectedFilePath) ?? null,
    [rawFiles, selectedFilePath],
  );

  useEffect(() => {
    setSelectedFilePath('');
    onFilterRdfChange('');
    onRangeFiltersChange({});
  }, [onFilterRdfChange, onRangeFiltersChange, resource.projectId, resource.resourceId]);

  useEffect(() => {
    if (!selectedFilePath && files.length) {
      setSelectedFilePath(searchFilePath(files[0]));
    }
  }, [files, selectedFilePath]);

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
        className="search-workspace-split"
        style={{
          '--form-width': `${formWidth}%`,
          '--files-width': `${100 - formWidth}%`,
        }}
      >
        <MetadataFilterForm
          isLoading={isLoading}
          onRangeFiltersChange={onRangeFiltersChange}
          profile={profile}
          rawFiles={rawFiles}
          resource={resource}
          selectedLanguage={selectedLanguage}
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
        <div className="search-files-column">
          <FileTable
            apiToken={apiToken}
            files={files}
            isLoading={isLoading}
            resource={resource}
            selectedFilePath={selectedFilePath}
            service={service}
            onSelectFile={(file) => setSelectedFilePath(searchFilePath(file))}
          />
          <FilePreview
            apiToken={apiToken}
            file={selectedFile}
            resource={resource}
            service={service}
          />
        </div>
      </div>
    </>
  );
}

function ResizeHandle({ onResize }) {
  const text = useAppText();
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
      aria-label={text.resizeFormAndFiles}
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
  rawFiles,
  resource,
  selectedLanguage,
  selectedFile,
}) {
  const text = useAppText();
  const normalizedMetadata = normalizeSearchMetadataForForm(selectedFile?.metadata, selectedFile);
  const formKey = `${resource.projectId}:${resource.resourceId}:${profile?.baseUri ?? 'none'}:${searchFilePath(selectedFile)}`;
  const numericRangeStats = useMemo(() => buildNumericRangeStats(rawFiles), [rawFiles]);

  return (
    <section className="form-panel">
      <div className="panel-title">
        <div>
          <h3>{text.metadataForm}</h3>
          <p>{selectedFile ? searchFilePath(selectedFile) : 'Select a file to fill the form.'}</p>
        </div>
        <button type="button" onClick={onClear}>
          {text.clear}
        </button>
      </div>

      {isLoading ? <p className="muted">{text.loadingShaclForm}</p> : null}
      {!isLoading && !profile?.shapes ? (
        <p className="muted">No SHACL application profile is available for this resource.</p>
      ) : null}
      {!isLoading && profile?.shapes && selectedFile && !normalizedMetadata.values ? (
        <p className="muted">The selected file has no RDF metadata values to prefill this form.</p>
      ) : null}
      {!isLoading && profile?.shapes ? (
        <SearchShaclFormHost
          formKey={formKey}
          numericRangeStats={numericRangeStats}
          shapes={profile.shapes}
          selectedLanguage={selectedLanguage}
          values={normalizedMetadata.values}
          valuesSubject={normalizedMetadata.subject}
          onRangeFiltersChange={onRangeFiltersChange}
          onSerializedChange={onFilterRdfChange}
        />
      ) : null}
    </section>
  );
}

function SearchShaclFormHost({
  formKey,
  numericRangeStats,
  onRangeFiltersChange,
  onSerializedChange,
  selectedLanguage,
  shapes,
  values,
  valuesSubject,
}) {
  const hostRef = useRef(null);
  const sanitizedShapes = useMemo(() => sanitizeShapesForForm(shapes), [shapes]);
  const rootShapeSubject = useMemo(() => findRootShapeSubject(sanitizedShapes), [sanitizedShapes]);
  const descriptionsByPath = useMemo(
    () => collectShapeDescriptionsByPath(sanitizedShapes, selectedLanguage),
    [sanitizedShapes, selectedLanguage],
  );
  const dirtyFilterPathsRef = useRef(new Set());

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !sanitizedShapes) {
      onSerializedChange('');
      return undefined;
    }

    dirtyFilterPathsRef.current = new Set();
    host.replaceChildren();

    const formElement = document.createElement('shacl-form');
    formElement.setAttribute('data-shapes', sanitizedShapes);
    formElement.setAttribute('data-language', selectedLanguage);
    if (rootShapeSubject) {
      formElement.setAttribute('data-shape-subject', rootShapeSubject);
    }
    formElement.setAttribute('data-show-root-shape-label', '');

    if (values) {
      formElement.setAttribute('data-values', values);
    }

    if (valuesSubject) {
      formElement.setAttribute('data-values-subject', valuesSubject);
    }

    const updateSerialized = (event) => {
      event?.preventDefault?.();
      const path = getSearchFilterEventPath(event);

      if (path) {
        dirtyFilterPathsRef.current.add(path);
      }

      onSerializedChange(collectSearchFormFilterText(formElement, dirtyFilterPathsRef.current));
    };
    let cleanupLiveFieldListeners = () => {};
    const enhanceForm = () => {
      enhanceRangeFields(formElement, onRangeFiltersChange, numericRangeStats);
      attachFieldDescriptionTooltips(formElement, descriptionsByPath);
      cleanupLiveFieldListeners();
      cleanupLiveFieldListeners = attachLiveFieldListeners(formElement, updateSerialized);
    };

    formElement.addEventListener('input', updateSerialized, true);
    formElement.addEventListener('change', updateSerialized);
    formElement.addEventListener('submit', updateSerialized);
    formElement.addEventListener('ready', enhanceForm);
    host.appendChild(formElement);
    const descriptionObserver = observeFieldDescriptionTooltips(formElement, descriptionsByPath);
    window.setTimeout(() => attachFieldDescriptionTooltips(formElement, descriptionsByPath), 0);
    window.setTimeout(() => attachFieldDescriptionTooltips(formElement, descriptionsByPath), 250);

    return () => {
      descriptionObserver.disconnect();
      cleanupLiveFieldListeners();
      formElement.removeEventListener('input', updateSerialized, true);
      formElement.removeEventListener('change', updateSerialized);
      formElement.removeEventListener('submit', updateSerialized);
      formElement.removeEventListener('ready', enhanceForm);
      host.replaceChildren();
    };
  }, [descriptionsByPath, formKey, numericRangeStats, onRangeFiltersChange, onSerializedChange, rootShapeSubject, sanitizedShapes, selectedLanguage, values, valuesSubject]);

  return <div className="shacl-form-host" ref={hostRef} />;
}

function FileTable({ apiToken, files, isLoading, onSelectFile, resource, selectedFilePath, service }) {
  const text = useAppText();

  return (
    <section className="files-panel">
      <div className="panel-title">
        <h3>{text.files}</h3>
        {isLoading ? <span>{text.loading}</span> : <span>{files.length}</span>}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{text.file}</th>
              <th>{text.download}</th>
            </tr>
          </thead>
          <tbody>
            {files.length ? (
              files.map((file, index) => (
                <tr
                  className={selectedFilePath === searchFilePath(file) ? 'selected-file-row' : ''}
                  key={`${searchFilePath(file)}-${index}`}
                  onClick={() => onSelectFile(file)}
                >
                  <td>{searchFilePath(file) || 'Untitled file'}</td>
                  <td>
                    <button
                      className="download-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadSearchFile({ apiToken, file, resource, service });
                      }}
                    >
                      {text.download}
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

function FilePreview({ apiToken, file, resource, service }) {
  const text = useAppText();
  const [previewState, setPreviewState] = useState({
    error: '',
    isLoading: false,
    kind: 'empty',
    objectUrl: '',
    text: '',
    type: '',
  });
  const path = searchFilePath(file);

  useEffect(() => {
    let isActive = true;
    let objectUrl = '';

    if (!file) {
      setPreviewState({
        error: '',
        isLoading: false,
        kind: 'empty',
        objectUrl: '',
        text: '',
        type: '',
      });
      return undefined;
    }

    setPreviewState({
      error: '',
      isLoading: true,
      kind: 'loading',
      objectUrl: '',
      text: '',
      type: '',
    });

    service.downloadFile(apiToken, {
      projectId: resource.projectId,
      resourceId: resource.resourceId,
      path,
    })
      .then(async (response) => {
        const blob = await response.blob();
        const type = blob.type || response.headers.get('content-type') || inferContentTypeFromPath(path);
        const kind = getPreviewKind(type, path);
        objectUrl = URL.createObjectURL(blob);
        const text = kind === 'text' ? await blob.text() : '';

        if (!isActive) {
          return;
        }

        setPreviewState({
          error: '',
          isLoading: false,
          kind,
          objectUrl,
          text,
          type,
        });
      })
      .catch((previewError) => {
        if (!isActive) {
          return;
        }

        setPreviewState({
          error: previewError.message || 'Could not load the file preview.',
          isLoading: false,
          kind: 'error',
          objectUrl: '',
          text: '',
          type: '',
        });
      });

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [apiToken, file, path, resource.projectId, resource.resourceId, service]);

  return (
    <section className="file-preview-panel">
      <div className="panel-title">
        <div>
          <h3>Preview</h3>
          <p>{path || 'Select a file to preview.'}</p>
        </div>
      </div>

      {file ? (
        <button
          className="preview-download-button"
          type="button"
          onClick={() => downloadSearchFile({ apiToken, file, resource, service })}
        >
          {text.download}
        </button>
      ) : null}

      {previewState.kind === 'empty' ? <div className="empty-state">Select a file to preview it.</div> : null}
      {previewState.isLoading ? <div className="empty-state">Loading preview...</div> : null}
      {previewState.kind === 'error' ? <div className="alert preview-alert">{previewState.error}</div> : null}
      {previewState.kind === 'image' ? (
        <div className="file-preview-media">
          <img src={previewState.objectUrl} alt={path} />
        </div>
      ) : null}
      {previewState.kind === 'pdf' ? (
        <iframe className="file-preview-frame" src={previewState.objectUrl} title={path} />
      ) : null}
      {previewState.kind === 'text' ? (
        <pre className="file-preview-text">{previewState.text || 'The file is empty.'}</pre>
      ) : null}
      {previewState.kind === 'unsupported' ? (
        <dl className="upload-facts upload-facts-compact">
          <div>
            <dt>File</dt>
            <dd>{path}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{previewState.type || 'Unknown'}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

async function downloadSearchFile({ apiToken, file, resource, service }) {
  const path = searchFilePath(file);

  try {
    const response = await service.downloadFile(apiToken, {
      projectId: resource.projectId,
      resourceId: resource.resourceId,
      path,
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = path.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (downloadError) {
    window.alert(downloadError.message || 'Could not download file.');
  }
}

function getPreviewKind(contentType, path) {
  const normalizedType = String(contentType ?? '').split(';')[0].trim().toLowerCase();
  const normalizedPath = String(path ?? '').toLowerCase();

  if (normalizedType.startsWith('image/')) {
    return 'image';
  }

  if (normalizedType === 'application/pdf' || normalizedPath.endsWith('.pdf')) {
    return 'pdf';
  }

  if (
    normalizedType.startsWith('text/') ||
    [
      'application/json',
      'application/ld+json',
      'application/xml',
      'application/xhtml+xml',
      'application/javascript',
      'application/x-javascript',
      'application/n-triples',
      'application/n-quads',
      'text/turtle',
    ].includes(normalizedType) ||
    /\.(csv|json|jsonld|md|n3|nt|ttl|txt|xml|yaml|yml)$/i.test(normalizedPath)
  ) {
    return 'text';
  }

  return 'unsupported';
}

function inferContentTypeFromPath(path) {
  const normalizedPath = String(path ?? '').toLowerCase();

  if (normalizedPath.endsWith('.pdf')) {
    return 'application/pdf';
  }

  if (/\.(apng|avif|gif|jpe?g|png|svg|webp)$/i.test(normalizedPath)) {
    return `image/${normalizedPath.split('.').pop().replace('jpg', 'jpeg')}`;
  }

  if (/\.(csv|json|jsonld|md|n3|nt|ttl|txt|xml|yaml|yml)$/i.test(normalizedPath)) {
    return 'text/plain';
  }

  return '';
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
        return true;
      }

      return values.some((metadataValue) => metadataValue.includes(value));
    });
  });
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

function collectSearchFormFilterText(formElement, dirtyPaths = null) {
  const root = formElement.shadowRoot ?? formElement;
  const values = Array.from(root.querySelectorAll('.property-instance[data-path] .editor'))
    .filter((editor) => !isRangeEditor(editor))
    .map((editor) => {
      const path = editor.closest('.property-instance[data-path]')?.dataset.path;
      const value = getEditorCurrentValue(editor);
      return path && (!dirtyPaths || dirtyPaths.has(path)) && value !== '' ? { path, value } : null;
    })
    .filter(Boolean);

  return JSON.stringify(values);
}

function getSearchFilterEventPath(event) {
  if (!event) {
    return '';
  }

  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  for (const item of path) {
    if (item?.dataset?.path) {
      return item.dataset.path;
    }

    const propertyInstance = item?.closest?.('.property-instance[data-path]');
    if (propertyInstance?.dataset?.path) {
      return propertyInstance.dataset.path;
    }
  }

  const target = event.target;
  if (target?.dataset?.path) {
    return target.dataset.path;
  }

  return target?.closest?.('.property-instance[data-path]')?.dataset?.path || '';
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
        return true;
      }

      return values.some((value) => Number.isFinite(value) && value >= min && value <= max);
    });
  });
}

function enhanceRangeFields(formElement, onRangeFiltersChange, numericRangeStats = new Map()) {
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

    const rangeStats = numericRangeStats.get(path);

    editor.dataset.rangeEnhanced = 'true';
    editor.dataset.rangeRole = 'min';

    if (isNumericRangeEditor(editor) && rangeStats?.count > 0 && rangeStats.min <= rangeStats.max) {
      enhanceNumericSliderRangeField({
        editor,
        formElement,
        max: rangeStats.max,
        min: rangeStats.min,
        onRangeFiltersChange,
        path,
      });
      continue;
    }

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

function enhanceNumericSliderRangeField({ editor, formElement, max, min, onRangeFiltersChange, path }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'metadata-slider-filter';

  const originalDisplay = editor.style.display;
  editor.style.display = 'none';
  editor.dataset.sliderOriginalDisplay = originalDisplay;
  editor.parentNode.insertBefore(wrapper, editor);
  wrapper.appendChild(editor);

  if (min === max) {
    const onlyValue = document.createElement('div');
    onlyValue.className = 'metadata-slider-filter__single-value';
    onlyValue.textContent = `Only one value: ${formatSliderValue(min)}`;
    wrapper.appendChild(onlyValue);
    return;
  }

  const sliderGrid = document.createElement('div');
  sliderGrid.className = 'metadata-slider-filter__grid';

  const minLabel = document.createElement('label');
  minLabel.className = 'metadata-slider-filter__label';
  minLabel.textContent = 'Min';

  const minSlider = document.createElement('input');
  minSlider.className = 'metadata-slider-filter__input';
  minSlider.type = 'range';
  minSlider.min = String(min);
  minSlider.max = String(max);
  minSlider.step = getNumericSliderStep(editor);
  minSlider.value = String(min);
  minSlider.dataset.path = path;
  minSlider.dataset.rangeRole = 'min';
  minSlider.setAttribute('aria-label', 'Minimum value');
  minLabel.appendChild(minSlider);

  const maxLabel = document.createElement('label');
  maxLabel.className = 'metadata-slider-filter__label';
  maxLabel.textContent = 'Max';

  const maxSlider = document.createElement('input');
  maxSlider.className = 'metadata-slider-filter__input';
  maxSlider.type = 'range';
  maxSlider.min = String(min);
  maxSlider.max = String(max);
  maxSlider.step = minSlider.step;
  maxSlider.value = String(max);
  maxSlider.dataset.path = path;
  maxSlider.dataset.rangeRole = 'max';
  maxSlider.setAttribute('aria-label', 'Maximum value');
  maxLabel.appendChild(maxSlider);

  const valueLine = document.createElement('div');
  valueLine.className = 'metadata-slider-filter__values';

  wrapper.appendChild(sliderGrid);
  sliderGrid.appendChild(minLabel);
  sliderGrid.appendChild(maxLabel);
  wrapper.appendChild(valueLine);

  const publishRange = () => {
    let selectedMin = Number(minSlider.value);
    let selectedMax = Number(maxSlider.value);

    if (selectedMin > selectedMax) {
      if (document.activeElement === minSlider) {
        selectedMax = selectedMin;
        maxSlider.value = String(selectedMax);
      } else {
        selectedMin = selectedMax;
        minSlider.value = String(selectedMin);
      }
    }

    valueLine.textContent = `${formatSliderValue(min)} to ${formatSliderValue(max)} | Selected: ${formatSliderValue(selectedMin)} to ${formatSliderValue(selectedMax)}`;

    onRangeFiltersChange((currentFilters) => {
      const nextFilters = { ...currentFilters };

      if (selectedMin > min || selectedMax < max) {
        nextFilters[path] = [selectedMin, selectedMax];
      } else {
        delete nextFilters[path];
      }

      return nextFilters;
    });
    formElement.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  };

  minSlider.addEventListener('input', publishRange);
  minSlider.addEventListener('change', publishRange);
  maxSlider.addEventListener('input', publishRange);
  maxSlider.addEventListener('change', publishRange);
  publishRange();
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

    .metadata-slider-filter {
      display: grid;
      gap: 8px;
      width: 100%;
    }

    .metadata-slider-filter__grid {
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr);
    }

    .metadata-slider-filter__label {
      color: #334155;
      display: grid;
      font-size: 0.75rem;
      font-weight: 800;
      gap: 6px;
      text-transform: uppercase;
    }

    .metadata-slider-filter__input {
      width: 100%;
    }

    .metadata-slider-filter__values {
      color: #475569;
      font-size: 0.82rem;
      font-weight: 700;
    }

    .metadata-slider-filter__single-value {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      color: #78350f;
      font-size: 0.86rem;
      font-weight: 800;
      padding: 8px 10px;
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

    const innerFields = Array.from(editor.shadowRoot?.querySelectorAll('input, textarea, select') ?? []);

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

function getEditorCurrentValue(editor) {
  const innerField = editor.shadowRoot?.querySelector('input, textarea, select');
  const field = innerField ?? editor;

  if (field.type === 'checkbox') {
    return field.checked ? 'true' : '';
  }

  return String(field.value ?? editor.value ?? editor.dataset?.value ?? '').trim();
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

function getNumericSliderStep(editor) {
  const step = editor.step || editor.getAttribute?.('step') || '';

  if (step && step !== 'any') {
    return step;
  }

  return isIntegerRangeEditor(editor) ? '1' : 'any';
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

function isNumericRangeEditor(editor) {
  const inputType = getEditorInputType(editor);
  const datatype = getEditorDatatype(editor);

  return (
    inputType === 'number' ||
    ['#integer', '#float', '#double', '#decimal'].some((suffix) => datatype.endsWith(suffix))
  );
}

function isIntegerRangeEditor(editor) {
  return getEditorDatatype(editor).endsWith('#integer') || editor.step === '1' || editor.getAttribute?.('step') === '1';
}

function buildNumericRangeStats(files) {
  const stats = new Map();

  for (const file of files ?? []) {
    const valueMap = extractRangeMetadataValueMap(file.metadata);

    for (const [path, values] of valueMap.entries()) {
      for (const value of values) {
        if (!Number.isFinite(value)) {
          continue;
        }

        const current = stats.get(path) ?? {
          count: 0,
          max: Number.NEGATIVE_INFINITY,
          min: Number.POSITIVE_INFINITY,
        };
        current.count += 1;
        current.min = Math.min(current.min, value);
        current.max = Math.max(current.max, value);
        stats.set(path, current);
      }
    }
  }

  return stats;
}

function formatSliderValue(value) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
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
    return extractTurtleRangeMetadataValueMap(metadata);
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

        if (Number.isFinite(rangeValue)) {
          const currentValues = valueMap.get(predicate) ?? [];
          currentValues.push(rangeValue);
          valueMap.set(predicate, currentValues);
        }
      }
    }
  }

  return valueMap;
}

function extractTurtleRangeMetadataValueMap(metadata) {
  const turtle = extractRdfMetadataString(metadata);
  const valueMap = new Map();

  if (!turtle) {
    return valueMap;
  }

  try {
    const quads = new Parser({ format: 'text/turtle' }).parse(turtle);

    for (const item of quads) {
      if (item.object.termType !== 'Literal') {
        continue;
      }

      const rangeValue = literalToRangeValue(item.object.value, item.object.datatype?.value ?? '');

      if (Number.isFinite(rangeValue)) {
        const currentValues = valueMap.get(item.predicate.value) ?? [];
        currentValues.push(rangeValue);
        valueMap.set(item.predicate.value, currentValues);
      }
    }
  } catch {
    return new Map();
  }

  return valueMap;
}

function extractRdfMetadataString(metadata) {
  if (!metadata) {
    return '';
  }

  if (typeof metadata === 'string') {
    return looksLikeRdf(metadata) ? metadata : '';
  }

  if (typeof metadata === 'object') {
    for (const key of ['content', 'metadata', 'data', 'value', 'rdf', 'ttl', 'turtle']) {
      const value = metadata[key];

      if (typeof value === 'string' && looksLikeRdf(value)) {
        return value;
      }
    }
  }

  return '';
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

function searchFilePath(file) {
  if (!file) {
    return '';
  }

  return String(file.path ?? file.name ?? file.fileName ?? file.key ?? file.id ?? '');
}

function normalizeSearchMetadataForForm(metadata, file) {
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
    return normalizeSearchMetadataForForm(metadata.content, file);
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
  const path = searchFilePath(file);
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

function TestEnvironmentView({ isEnabled, onDeleteResource, onDeleteUpload, onRefresh, resources, uploadedFiles }) {
  const text = useAppText();
  const createdResources = resources.filter((resource) => resource.isCustomResource || resource.shaclFileName);
  const groupedResources = groupResourcesByProject(createdResources);
  const [selectedViewResourceKey, setSelectedViewResourceKey] = useState('');
  const [selectedUploadKey, setSelectedUploadKey] = useState('');
  const selectedViewResource =
    createdResources.find((resource) => resourceKey(resource) === selectedViewResourceKey) ??
    createdResources[0] ??
    null;
  const selectedUpload =
    uploadedFiles.find((file) => file.storageKey === selectedUploadKey) ??
    uploadedFiles[0] ??
    null;

  useEffect(() => {
    if (!createdResources.length) {
      setSelectedViewResourceKey('');
      return;
    }

    if (!selectedViewResourceKey || !createdResources.some((resource) => resourceKey(resource) === selectedViewResourceKey)) {
      setSelectedViewResourceKey(resourceKey(createdResources[0]));
    }
  }, [createdResources, selectedViewResourceKey]);

  useEffect(() => {
    if (!uploadedFiles.length) {
      setSelectedUploadKey('');
      return;
    }

    if (!selectedUploadKey || !uploadedFiles.some((file) => file.storageKey === selectedUploadKey)) {
      setSelectedUploadKey(uploadedFiles[0].storageKey);
    }
  }, [selectedUploadKey, uploadedFiles]);

  if (!isEnabled) {
    return <div className="empty-state">Switch to the test environment to inspect virtual resources.</div>;
  }

  return (
    <section className="view-grid">
      <div className="view-panel">
        <div className="panel-title">
          <div>
            <h3>Created resources</h3>
            <p>Resources created in the emulator are stored locally in this browser.</p>
          </div>
          <button className="refresh-button" type="button" onClick={onRefresh}>
            {text.refresh}
          </button>
        </div>

        {groupedResources.length ? (
          groupedResources.map((project) => (
            <div className="project-group" key={project.id}>
              <div className="project-heading">
                <strong>{project.name}</strong>
                <span>{project.resources.length}</span>
              </div>
              {project.resources.map((resource) => (
                <div className="managed-row" key={resourceKey(resource)}>
                  <button
                    className={
                      selectedViewResource && resourceKey(resource) === resourceKey(selectedViewResource)
                        ? 'view-row selectable-row active'
                        : 'view-row selectable-row'
                    }
                    type="button"
                    onClick={() => setSelectedViewResourceKey(resourceKey(resource))}
                  >
                    <strong>{resource.resourceName}</strong>
                    <span>{resource.resourceType || 'Resource'}</span>
                    <small>{resource.shaclFileName ? `SHACL file: ${resource.shaclFileName}` : 'Created resource'}</small>
                  </button>
                  <button
                    className="delete-row-button"
                    type="button"
                    onClick={() => onDeleteResource(resource)}
                  >
                    {text.delete}
                  </button>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="empty-state">No resources have been created yet.</div>
        )}

        {selectedViewResource ? (
          <SelectedResourceDetails resource={selectedViewResource} />
        ) : null}
      </div>

      <div className="view-panel">
        <div className="panel-title">
          <div>
            <h3>Uploaded files</h3>
            <p>Files uploaded through the emulator are listed here with their metadata snapshot.</p>
          </div>
          <button className="refresh-button" type="button" onClick={onRefresh}>
            {text.refresh}
          </button>
        </div>

        {uploadedFiles.length ? (
          <>
            <div className="selectable-list">
              {uploadedFiles.map((file) => (
                <div className="managed-row" key={file.storageKey}>
                  <button
                    className={file.storageKey === selectedUpload?.storageKey ? 'upload-record active' : 'upload-record'}
                    type="button"
                    onClick={() => setSelectedUploadKey(file.storageKey)}
                  >
                    <div className="upload-record-head">
                      <strong>{file.fileName}</strong>
                      <span>{formatBytes(file.fileSize)}</span>
                    </div>
                    <small>{file.resourceName || file.resourceId}</small>
                  </button>
                  <button
                    className="delete-row-button"
                    type="button"
                    onClick={() => onDeleteUpload(file)}
                  >
                    {text.delete}
                  </button>
                </div>
              ))}
            </div>
            <SelectedUploadDetails file={selectedUpload} />
          </>
        ) : (
          <div className="empty-state">No uploaded files yet.</div>
        )}
      </div>
    </section>
  );
}

function SelectedResourceDetails({ resource }) {
  return (
    <div className="selected-details">
      <h3>Selected resource</h3>
      <dl className="upload-facts upload-facts-compact">
        <div>
          <dt>Name</dt>
          <dd>{resource.resourceName}</dd>
        </div>
        <div>
          <dt>Project</dt>
          <dd>{resource.projectName || resource.projectId}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{resource.resourceType || 'Resource'}</dd>
        </div>
        <div>
          <dt>SHACL file</dt>
          <dd>{resource.shaclFileName || 'n/a'}</dd>
        </div>
      </dl>
    </div>
  );
}

function SelectedUploadDetails({ file }) {
  if (!file) {
    return null;
  }

  return (
    <div className="selected-details">
      <h3>Selected file</h3>
      <dl className="upload-facts upload-facts-compact">
        <div>
          <dt>Resource</dt>
          <dd>{file.resourceName || file.resourceId}</dd>
        </div>
        <div>
          <dt>Project</dt>
          <dd>{file.projectName || file.projectId}</dd>
        </div>
        <div>
          <dt>Uploaded</dt>
          <dd>{file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : 'n/a'}</dd>
        </div>
        <div>
          <dt>SHACL file</dt>
          <dd>{file.shaclFileName || 'n/a'}</dd>
        </div>
      </dl>
      <details open>
        <summary>Serialized metadata</summary>
        <pre>{file.metadataContent}</pre>
      </details>
    </div>
  );
}

function UploadWorkspace({
  isLoadingProfile,
  isUploading,
  metadataFormRef,
  metadataValid,
  metadataValidationSummary,
  onFileChange,
  onMetadataChange,
  onMetadataValidChange,
  onMetadataValidationSummaryChange,
  onRememberedFieldPathsChange,
  onRememberedFieldsChange,
  onTargetPathChange,
  onUpload,
  profile,
  rememberedFieldPaths,
  resource,
  selectedLanguage,
  serviceLabel,
  selectedFile,
  targetPath,
}) {
  const text = useAppText();
  const canUpload = Boolean(profile?.shapes && selectedFile && targetPath.trim() && metadataValid);
  const formMemoryContextKey = getFormMemoryContextKey(profile, resource);
  const rememberedMetadataContent = useMemo(
    () => buildRememberedMetadataContent(formMemoryContextKey, profile),
    [formMemoryContextKey, profile],
  );
  const rememberedValuesSubject = useMemo(
    () => getRememberedValuesSubject(formMemoryContextKey),
    [formMemoryContextKey],
  );
  const rememberedFieldPathsRef = useRef(rememberedFieldPaths);

  useEffect(() => {
    onRememberedFieldPathsChange(readRememberedFieldSelection(formMemoryContextKey, profile));
    onRememberedFieldsChange([]);
  }, [formMemoryContextKey, onRememberedFieldPathsChange, onRememberedFieldsChange, profile]);

  useEffect(() => {
    rememberedFieldPathsRef.current = rememberedFieldPaths;
  }, [rememberedFieldPaths]);

  const persistRememberedFieldValues = useCallback((metadataContentToSave, fields, fieldPaths) => {
    saveRememberedFormFields({
      contextKey: formMemoryContextKey,
      fieldPaths: fieldPaths ?? rememberedFieldPathsRef.current,
      fields,
      metadataContent: metadataContentToSave,
      profile,
    });
  }, [formMemoryContextKey, profile]);

  const toggleRememberedField = useCallback((path) => {
    const nextPaths = new Set(rememberedFieldPathsRef.current);

    if (nextPaths.has(path)) {
      nextPaths.delete(path);
    } else {
      nextPaths.add(path);
    }

    const nextSelection = Array.from(nextPaths);
    writeRememberedFieldSelection(formMemoryContextKey, nextSelection);
    rememberedFieldPathsRef.current = nextSelection;
    onRememberedFieldPathsChange(nextSelection);
    return nextSelection;
  }, [formMemoryContextKey, onRememberedFieldPathsChange]);

  return (
    <>
      <div className="detail-header">
        <div>
          <p className="eyebrow">{resource.projectName}</p>
          <h2>{resource.resourceName}</h2>
        </div>
        <span>{resource.resourceType || 'Resource'}</span>
      </div>

      <div className="metadata-line">
        <span>{resource.applicationProfileUri || 'No application profile URI'}</span>
      </div>
      {resource.shaclFileName ? (
        <div className="metadata-line shacl-file-line">
          <span>SHACL file: {resource.shaclFileName}</span>
        </div>
      ) : null}

      <div className="workspace-split">
        <section className="form-panel">
          <div className="panel-title">
            <div>
              <h3>{text.requiredMetadata}</h3>
              <p>{profile?.baseUri || 'Load the selected resource form.'}</p>
            </div>
            <span>{metadataValid ? text.ready : text.pending}</span>
          </div>
          {metadataValidationSummary ? (
            <div className="validation-summary" role="alert">
              {metadataValidationSummary}
            </div>
          ) : null}

          {isLoadingProfile ? <p className="muted">{text.loadingShaclForm}</p> : null}
          {!isLoadingProfile && profile?.shapes ? (
            <>
              <div className="memory-panel">
                <div>
                  <h3>{text.browserMemory}</h3>
                  <p>{text.useMemoryCheckbox}</p>
                </div>
                {formMemoryContextKey && rememberedFieldPaths.length ? (
                  <button
                    className="memory-clear-button"
                    type="button"
                    onClick={() => {
                      clearRememberedFormFields(formMemoryContextKey);
                      onRememberedFieldPathsChange([]);
                    }}
                  >
                    {text.clearSavedValues}
                  </button>
                ) : null}
              </div>
              <ShaclFormHost
                formKey={`${resource.projectId}:${resource.resourceId}:${profile.baseUri}:${rememberedMetadataContent}`}
                formElementRef={metadataFormRef}
                rememberedMetadataContent={rememberedMetadataContent}
                rememberedFieldPaths={rememberedFieldPaths}
                selectedLanguage={selectedLanguage}
                rememberedValuesSubject={rememberedValuesSubject}
                shapes={profile.shapes}
                onFieldsDetected={onRememberedFieldsChange}
                onMetadataChange={onMetadataChange}
                onMetadataValidChange={onMetadataValidChange}
                onMetadataValidationSummaryChange={onMetadataValidationSummaryChange}
                onRememberedFieldToggle={toggleRememberedField}
                onRememberedValuesChange={persistRememberedFieldValues}
              />
            </>
          ) : null}
        </section>

        <section className="upload-panel">
          <div className="panel-title">
            <div>
              <h3>{text.selectedFile}</h3>
              <p>The chosen file is uploaded through {serviceLabel}.</p>
            </div>
          </div>

          <label className="field-label">
            {text.file}
            <input type="file" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
          </label>

          <label className="field-label">
            {text.coscinePath}
            <input
              value={targetPath}
              placeholder="folder/name.ext"
              onChange={(event) => onTargetPathChange(event.target.value)}
            />
          </label>

          <dl className="upload-facts">
            <div>
              <dt>{text.selectedFile}</dt>
              <dd>{selectedFile?.name || 'None'}</dd>
            </div>
          </dl>

          <button className="primary-action" type="button" disabled={!canUpload || isUploading} onClick={onUpload}>
            {isUploading ? text.uploading : text.uploadFile}
          </button>
        </section>
      </div>
    </>
  );
}

function ShaclFormHost({
  formElementRef,
  formKey,
  onFieldsDetected,
  onMetadataChange,
  onMetadataValidChange,
  onMetadataValidationSummaryChange,
  onRememberedFieldToggle,
  onRememberedValuesChange,
  rememberedMetadataContent,
  rememberedFieldPaths,
  rememberedValuesSubject,
  selectedLanguage,
  shapes,
}) {
  const hostRef = useRef(null);
  const fieldsRef = useRef([]);
  const rememberedFieldPathsRef = useRef(rememberedFieldPaths);
  const rememberedFieldPathSet = useMemo(() => new Set(rememberedFieldPaths), [rememberedFieldPaths]);
  const sanitizedShapes = useMemo(() => sanitizeShapesForForm(shapes), [shapes]);
  const rootShapeSubject = useMemo(() => findRootShapeSubject(sanitizedShapes), [sanitizedShapes]);
  const descriptionsByPath = useMemo(
    () => collectShapeDescriptionsByPath(sanitizedShapes, selectedLanguage),
    [sanitizedShapes, selectedLanguage],
  );

  useEffect(() => {
    rememberedFieldPathsRef.current = rememberedFieldPaths;
  }, [rememberedFieldPaths]);

  useEffect(() => {
    const host = hostRef.current;

    if (!host || !sanitizedShapes) {
      onMetadataChange('');
      onMetadataValidChange(false);
      onMetadataValidationSummaryChange('');
      formElementRef.current = null;
      return undefined;
    }

    host.replaceChildren();

    const formElement = document.createElement('shacl-form');
    formElement.setAttribute('data-shapes', sanitizedShapes);
    formElement.setAttribute('data-language', selectedLanguage);
    if (rootShapeSubject) {
      formElement.setAttribute('data-shape-subject', rootShapeSubject);
    }
    if (rememberedMetadataContent) {
      formElement.setAttribute('data-values', rememberedMetadataContent);
      formElement.setAttribute('data-values-subject', rememberedValuesSubject);
    }
    formElement.setAttribute('data-show-root-shape-label', '');
    formElementRef.current = formElement;
    let validityRequestId = 0;
    let validationIndicatorFrame = 0;

    const saveCurrentRememberedValues = (fieldPaths = rememberedFieldPathsRef.current) => {
      if (!fieldPaths.length || typeof formElement.serialize !== 'function') {
        return;
      }

      const serializedMetadata = formElement.serialize();

      if (String(serializedMetadata ?? '').trim()) {
        onRememberedValuesChange(serializedMetadata, fieldsRef.current, fieldPaths);
      }
    };

    const refreshValidity = async () => {
      const requestId = (validityRequestId += 1);

      if (typeof formElement.validate !== 'function') {
        const serializedMetadata = typeof formElement.serialize === 'function' ? formElement.serialize() : '';
        onMetadataValidChange(Boolean(String(serializedMetadata ?? '').trim()));
        onMetadataValidationSummaryChange('');
        syncValidationIndicators(formElement, null);
        return;
      }

      try {
        const validationReport = await formElement.validate(false);

        if (requestId !== validityRequestId) {
          return;
        }

        const serializedMetadata = typeof formElement.serialize === 'function' ? formElement.serialize() : '';
        const isValid = Boolean(validationReport?.conforms && String(serializedMetadata ?? '').trim());
        onMetadataValidChange(isValid);
        onMetadataChange(isValid ? serializedMetadata : '');
        onMetadataValidationSummaryChange(isValid ? '' : formatValidationReport(formElement, validationReport));
        syncValidationIndicators(formElement, validationReport);
      } catch {
        if (requestId === validityRequestId) {
          onMetadataValidChange(false);
          onMetadataChange('');
          onMetadataValidationSummaryChange('Could not validate the metadata form.');
          syncValidationIndicators(formElement, null);
        }
      }
    };

    const detectFields = () => {
      const fields = detectMemoryFields(formElement);
      fieldsRef.current = fields;
      onFieldsDetected(fields);
      decorateMemoryFields(
        formElement,
        new Set(rememberedFieldPathsRef.current),
        onRememberedFieldToggle,
        saveCurrentRememberedValues,
      );
      attachFieldDescriptionTooltips(formElement, descriptionsByPath);
      saveCurrentRememberedValues();
      refreshValidity();
    };

    const scheduleValidationIndicatorSync = () => {
      window.cancelAnimationFrame(validationIndicatorFrame);
      validationIndicatorFrame = window.requestAnimationFrame(() => {
        syncValidationIndicators(formElement);
      });
    };

    const handleChange = () => {
      saveCurrentRememberedValues();
      refreshValidity();
      scheduleValidationIndicatorSync();
    };

    const handleInput = () => {
      saveCurrentRememberedValues();
      refreshValidity();
      scheduleValidationIndicatorSync();
    };

    const handleSubmit = (event) => {
      event.preventDefault();
      refreshValidity();
      scheduleValidationIndicatorSync();
    };

    formElement.addEventListener('change', handleChange);
    formElement.addEventListener('input', handleInput);
    formElement.addEventListener('ready', detectFields);
    formElement.addEventListener('submit', handleSubmit);
    host.appendChild(formElement);
    hideShaclFormSubmitButton(formElement);
    const descriptionObserver = observeFieldDescriptionTooltips(formElement, descriptionsByPath);
    const validationObserver = new MutationObserver((mutations) => {
      if (
        mutations.some(
          (mutation) =>
            mutation.type === 'attributes' &&
            mutation.attributeName === 'class' &&
            mutation.target?.classList?.contains('property-instance'),
        )
      ) {
        scheduleValidationIndicatorSync();
      }
    });
    validationObserver.observe(getFormRoot(formElement), {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    });
    window.setTimeout(detectFields, 0);
    window.setTimeout(detectFields, 250);

    return () => {
      window.cancelAnimationFrame(validationIndicatorFrame);
      descriptionObserver.disconnect();
      validationObserver.disconnect();
      formElement.removeEventListener('change', handleChange);
      formElement.removeEventListener('input', handleInput);
      formElement.removeEventListener('ready', detectFields);
      formElement.removeEventListener('submit', handleSubmit);
      if (formElementRef.current === formElement) {
        formElementRef.current = null;
      }
      host.replaceChildren();
    };
  }, [
    formElementRef,
    formKey,
    onFieldsDetected,
    onMetadataChange,
    onMetadataValidChange,
    onMetadataValidationSummaryChange,
    onRememberedFieldToggle,
    onRememberedValuesChange,
    rememberedMetadataContent,
    rememberedValuesSubject,
    descriptionsByPath,
    rootShapeSubject,
    selectedLanguage,
    sanitizedShapes,
  ]);

  useEffect(() => {
    const formElement = formElementRef.current;

    if (!formElement) {
      return;
    }

    for (const input of getFormRoot(formElement).querySelectorAll('[data-memory-control]')) {
      input.checked = rememberedFieldPathSet.has(input.dataset.memoryPath);
    }
  }, [formElementRef, rememberedFieldPathSet]);

  return <div className="shacl-form-host" ref={hostRef} />;
}

function sanitizeShapesForForm(shapes) {
  if (!shapes || typeof shapes !== 'string') {
    return '';
  }

  try {
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(shapes);
    const filteredQuads = quads
      .filter((item) => {
        if (item.predicate.value !== OWL_IMPORTS || item.object.termType !== 'NamedNode') {
          return true;
        }

        return !isQuadtImportUrl(item.object.value);
      })
      .map((item) => normalizeShapeQuad(item));

    if (
      filteredQuads.length === quads.length &&
      filteredQuads.every((item, index) => item.equals(quads[index]))
    ) {
      return shapes;
    }

    const writer = new Writer({ format: 'text/turtle' });
    writer.addQuads(filteredQuads);

    let serialized = '';
    writer.end((error, output) => {
      if (error) {
        throw error;
      }

      serialized = output;
    });

    return serialized || shapes;
  } catch {
    return shapes;
  }
}

function normalizeShapeQuad(item) {
  if (
    item.predicate.value === 'http://www.w3.org/ns/shacl#pattern' &&
    item.object.termType === 'Literal' &&
    (item.object.value === '^[A-Za-z0-9]+([-_][A-Za-z0-9]+)*$' ||
      item.object.value === '^[A-Za-z0-9]+([_-][A-Za-z0-9]+)*$')
  ) {
    return quad(
      item.subject,
      item.predicate,
      literal('^[A-Za-z0-9]+([_\\-][A-Za-z0-9]+)*$', item.object.datatype),
      item.graph,
    );
  }

  return item;
}

function isQuadtImportUrl(value) {
  return /^https?:\/\/qudt\.org(?:\/|$)/i.test(String(value ?? ''));
}

function findRootShapeSubject(shapes) {
  if (!shapes || typeof shapes !== 'string') {
    return '';
  }

  try {
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(shapes);
    const targetClassShape = quads.find(
      (item) => item.predicate.value === SH_TARGET_CLASS && item.subject.termType === 'NamedNode',
    )?.subject;

    if (targetClassShape) {
      return targetClassShape.value;
    }

    return quads.find(
      (item) =>
        item.predicate.value === RDF_TYPE &&
        item.object.termType === 'NamedNode' &&
        item.object.value === SH_NODE_SHAPE &&
        item.subject.termType === 'NamedNode',
    )?.subject.value || '';
  } catch {
    return '';
  }
}

function collectShapeDescriptionsByPath(shapes, preferredLanguage = 'en') {
  const descriptionsByPath = new Map();

  if (!shapes || typeof shapes !== 'string') {
    return descriptionsByPath;
  }

  try {
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(shapes);
    const propertyShapes = new Set(
      quads
        .filter((item) => item.predicate.value === SH_PATH)
        .map((item) => item.subject),
    );

    for (const propertyShape of propertyShapes) {
      const path = getFirstQuadObjectValue(quads, propertyShape, SH_PATH);
      const description = getPreferredQuadLiteral(quads, propertyShape, SH_DESCRIPTION, preferredLanguage);

      if (path && description && !descriptionsByPath.has(path)) {
        descriptionsByPath.set(path, description);
      }
    }
  } catch {
  }

  return descriptionsByPath;
}

function attachFieldDescriptionTooltips(formElement, descriptionsByPath) {
  if (!formElement || !descriptionsByPath?.size) {
    return;
  }

  const root = getFormRoot(formElement);

  for (const propertyInstance of root.querySelectorAll('.property-instance[data-path], [data-path]')) {
    const path = propertyInstance.dataset.path;
    const description = descriptionsByPath.get(path);

    if (!path || !description) {
      continue;
    }

    const field = getDirectPropertyField(propertyInstance);
    const directLabel = propertyInstance.querySelector(':scope > label');
    const label = directLabel ?? field?.querySelector?.(':scope > label') ?? propertyInstance.querySelector('label');
    const editor = getDirectPropertyEditor(propertyInstance, field);
    const target = label ?? editor ?? propertyInstance;

    if (!target) {
      continue;
    }

    target.title = description;
    target.dataset.shaclDescriptionTooltip = 'true';

    if (!target.getAttribute('aria-description')) {
      target.setAttribute('aria-description', description);
    }

    if (editor && !editor.getAttribute('aria-description')) {
      editor.setAttribute('aria-description', description);
    }
  }
}

function observeFieldDescriptionTooltips(formElement, descriptionsByPath) {
  const root = getFormRoot(formElement);
  let frame = 0;
  const scheduleSync = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(() => {
      attachFieldDescriptionTooltips(formElement, descriptionsByPath);
    });
  };
  const observer = new MutationObserver(scheduleSync);

  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  return {
    disconnect() {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    },
  };
}

function detectMemoryFields(formElement) {
  const root = getFormRoot(formElement);
  const fieldsByPath = new Map();

  for (const editor of root.querySelectorAll('.editor, input, select, textarea')) {
    if (editor.type === 'file' || editor.dataset.memoryControl === 'true') {
      continue;
    }

    const element = editor.closest('[data-path]');
    const path = element?.dataset.path;

    if (!path || fieldsByPath.has(path)) {
      continue;
    }

    fieldsByPath.set(path, {
      label: findFieldLabel(element, path),
      path,
    });
  }

  return Array.from(fieldsByPath.values()).sort((left, right) => left.label.localeCompare(right.label));
}

function decorateMemoryFields(formElement, rememberedFieldPathSet, onRememberedFieldToggle, onRememberedValuesSave) {
  const root = getFormRoot(formElement);
  const decoratedPaths = new Set();

  for (const editor of root.querySelectorAll('.editor, input, select, textarea')) {
    if (editor.type === 'file' || editor.dataset.memoryControl === 'true') {
      continue;
    }

    const element = editor.closest('[data-path]');
    const path = element?.dataset.path;

    if (!element || !path || decoratedPaths.has(path)) {
      continue;
    }

    decoratedPaths.add(path);
    element.classList.add('memory-has-inline-control');

    const existingControl = Array.from(element.children).find(
      (child) => child.classList?.contains('memory-inline-control') && child.dataset.memoryPath === path,
    );

    if (existingControl) {
      const existingCheckbox = existingControl.querySelector('input[data-memory-control]');
      if (existingCheckbox) {
        existingCheckbox.checked = rememberedFieldPathSet.has(path);
      }
      continue;
    }

    const control = document.createElement('label');
    control.className = 'memory-inline-control';
    control.dataset.memoryPath = path;
    control.title = 'Remember this field value in this browser after upload';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = rememberedFieldPathSet.has(path);
    checkbox.dataset.memoryControl = 'true';
    checkbox.dataset.memoryPath = path;
    checkbox.addEventListener('change', (event) => {
      event.stopPropagation();
      const nextSelection = onRememberedFieldToggle(path);
      onRememberedValuesSave(nextSelection);
    });

    control.append(checkbox);
    element.insertBefore(control, element.firstChild);
  }
}

function getFormRoot(formElement) {
  return formElement.shadowRoot ?? formElement;
}

function findFieldLabel(element, fallbackPath) {
  const label = element.querySelector('label');
  const labelClone = label?.cloneNode(true);
  labelClone?.querySelectorAll?.('.validation-ok').forEach((node) => node.remove());
  const labelText = labelClone?.textContent?.trim();

  if (labelText) {
    return labelText.replace(/\s+/g, ' ');
  }

  return fallbackPath.split(/[\/#]/).filter(Boolean).at(-1) || fallbackPath;
}

function formatValidationReport(formElement, validationReport) {
  const results = collectValidationResults(validationReport);
  const messages = results
    .map((result) => formatValidationResult(formElement, result))
    .filter(Boolean);
  const domMessages = collectFormValidationMessages(formElement);
  const uniqueMessages = Array.from(
    new Set(
      [...messages, ...domMessages]
        .map((message) => normalizeValidationMessage(message, { formElement }))
        .filter(Boolean),
    ),
  );

  if (!uniqueMessages.length) {
    return validationReport?.conforms === false
      ? 'Complete the highlighted metadata fields before uploading.'
      : '';
  }

  const visibleMessages = uniqueMessages.slice(0, 5);
  const remainingCount = uniqueMessages.length - visibleMessages.length;
  const suffix = remainingCount > 0 ? ` ${remainingCount} more issue${remainingCount === 1 ? '' : 's'} remain.` : '';

  return `${visibleMessages.join(' ')}${suffix}`;
}

function formatValidationResult(formElement, result) {
  if (!result || typeof result !== 'object') {
    return '';
  }

  const path = getValidationResultPath(result);
  const label = findValidationFieldLabel(formElement, path);
  const rawMessage = describeConstraint(result, { formElement, label, path }) || getPreferredLiteralValue(result.message) || 'Invalid value.';
  const message = normalizeValidationMessage(rawMessage, { formElement, label, path });
  const details = getValidationResultDetails(result);
  const fieldPrefix = label ? `${label}: ` : '';

  return message.startsWith(label) || message.includes(' is incomplete.')
    ? `${message}${details}`.trim()
    : `${fieldPrefix}${message}${details}`.trim();
}

function getValidationResultPath(result) {
  const directPath = getTermValue(result.path || result.resultPath);
  if (directPath) {
    return directPath;
  }

  const pathStep = Array.isArray(result.path) ? result.path[0] : null;
  const predicate = Array.isArray(pathStep?.predicates) ? pathStep.predicates[0] : null;

  return getTermValue(predicate);
}

function getTermValue(term) {
  if (!term) {
    return '';
  }

  if (Array.isArray(term)) {
    return getTermValue(term[0]);
  }

  return term.id || term.value || term.term?.id || term.term?.value || '';
}

function findValidationFieldLabel(formElement, path) {
  if (!path) {
    return '';
  }

  const root = getFormRoot(formElement);
  const element = root.querySelector(`[data-path="${CSS.escape(path)}"]`);

  if (element) {
    return findFieldLabel(element, path);
  }

  return findFieldLabelFromPath(path);
}

function getPreferredLiteralValue(literals) {
  const values = Array.isArray(literals) ? literals : [];
  const english = values.find((item) => item?.language === 'en');
  const untagged = values.find((item) => !item?.language);
  const selected = english || untagged || values[0];

  return selected?.value || '';
}

function describeConstraint(result, { formElement = null, label = '', path = '' } = {}) {
  const constraint = result.constraintComponent?.value || result.constraintComponent?.id || '';

  if (constraint === SH_MIN_LENGTH_CONSTRAINT && result.args?.minLength) {
    return `Minimum length is ${result.args.minLength} characters.`;
  }

  if (constraint === SH_MIN_COUNT_CONSTRAINT && result.args?.minCount) {
    return `At least ${result.args.minCount} value${Number(result.args.minCount) === 1 ? '' : 's'} required.`;
  }

  if (constraint === SH_QUALIFIED_MIN_COUNT_CONSTRAINT) {
    return describeQualifiedSectionConstraint(label, path, formElement);
  }

  return '';
}

function describeQualifiedSectionConstraint(label, path, formElement = null) {
  const sectionName = label || findFieldLabelFromPath(path) || 'This section';
  return describeShapeRestrictionsForPath(formElement, path) ||
    `${sectionName} is incomplete. Check the highlighted required fields in this section.`;
}

function describeShapeRestrictionsForPath(formElement, path) {
  if (!formElement?.dataset?.shapes || !path) {
    return '';
  }

  try {
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(formElement.dataset.shapes);
    const rootProperty = quads.find((item) => item.predicate.value === SH_PATH && item.object.value === path)?.subject;
    const shape = rootProperty
      ? quads.find((item) => item.subject.equals(rootProperty) && item.predicate.value === SH_QUALIFIED_VALUE_SHAPE)?.object
      : null;

    if (!shape) {
      return '';
    }

    return describeShapeRestrictions(formElement, quads, shape, findValidationFieldLabel(formElement, path), path);
  } catch {
    return '';
  }
}

function describeShapeRestrictionsFromMessage(formElement, message, fallbackLabel = '') {
  const shapeIri = extractShapeIriFromMessage(message);

  if (!shapeIri || !formElement?.dataset?.shapes) {
    return '';
  }

  try {
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(formElement.dataset.shapes);
    const shape = resolveShapeTerm(quads, namedNode(shapeIri));
    return describeShapeRestrictions(formElement, quads, shape, fallbackLabel || findFieldLabelFromPath(shapeIri));
  } catch {
    return '';
  }
}

function describeShapeRestrictions(formElement, quads, shape, fallbackLabel = '', sectionPath = '') {
  const resolvedShape = resolveShapeTerm(quads, shape);
  const shapeLabel = findShapeTitle(quads, resolvedShape) || fallbackLabel || findFieldLabelFromPath(resolvedShape.value);
  const currentIssues = describeCurrentShapeIssues(formElement, quads, resolvedShape, sectionPath);

  if (currentIssues) {
    return `${shapeLabel} is incomplete. ${currentIssues.join('. ')}.`;
  }

  const restrictions = describeRequiredShapeProperties(quads, resolvedShape);

  if (!restrictions.length) {
    return `${shapeLabel} is incomplete. Check the highlighted required fields in this section.`;
  }

  return `${shapeLabel} is incomplete. Required fields in this section: ${restrictions.join('; ')}.`;
}

function extractShapeIriFromMessage(message) {
  const rawMessage = String(message ?? '');
  const iriMatch = rawMessage.match(/shape\s+<([^>]+)>/i);

  if (iriMatch?.[1]) {
    return iriMatch[1];
  }

  const compactMatch = rawMessage.match(/shape\s+([A-Za-z][\w-]*:[\w-]+)/i);
  return compactMatch?.[1] || '';
}

function findShapeTitle(quads, shape) {
  const titlePredicates = [
    'http://purl.org/dc/terms/title',
    'http://www.w3.org/2000/01/rdf-schema#label',
    SH_NAME,
  ];

  for (const predicate of titlePredicates) {
    const value = getPreferredQuadLiteral(quads, shape, predicate);

    if (value) {
      return value;
    }
  }

  return '';
}

function describeRequiredShapeProperties(quads, shape) {
  const resolvedShape = resolveShapeTerm(quads, shape);

  return quads
    .filter((item) => item.subject.equals(resolvedShape) && item.predicate.value === SH_PROPERTY)
    .map((item) => describeRequiredPropertyShape(quads, item.object))
    .filter(Boolean);
}

function describeCurrentShapeIssues(formElement, shapeQuads, shape, sectionPath = '') {
  if (!formElement || typeof formElement.serialize !== 'function') {
    return [];
  }

  try {
    const metadataContent = formElement.serialize();

    if (!String(metadataContent ?? '').trim()) {
      return [];
    }

    const dataQuads = new Parser({ format: 'text/turtle' }).parse(metadataContent);
    const rootSubject = findRootMetadataSubject(dataQuads);
    const resolvedShape = resolveShapeTerm(shapeQuads, shape);
    const resolvedSectionPath = sectionPath || findSectionPathForShape(shapeQuads, resolvedShape);
    const sectionSubject = rootSubject && resolvedSectionPath
      ? dataQuads.find((item) => item.subject.equals(rootSubject) && item.predicate.value === resolvedSectionPath)?.object
      : rootSubject;

    if (!sectionSubject) {
      return describeRequiredShapeProperties(shapeQuads, resolvedShape);
    }

    return shapeQuads
      .filter((item) => item.subject.equals(resolvedShape) && item.predicate.value === SH_PROPERTY)
      .map((item) => describeCurrentPropertyIssue(shapeQuads, dataQuads, sectionSubject, item.object))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function findSectionPathForShape(quads, shape) {
  const propertyShape = quads.find(
    (item) => item.predicate.value === SH_QUALIFIED_VALUE_SHAPE && resolveShapeTerm(quads, item.object).equals(shape),
  )?.subject;

  return propertyShape ? getFirstQuadObjectValue(quads, propertyShape, SH_PATH) : '';
}

function describeCurrentPropertyIssue(shapeQuads, dataQuads, subject, propertyShape) {
  const path = getFirstQuadObjectValue(shapeQuads, propertyShape, SH_PATH);
  const minCount = Number(getFirstQuadObjectValue(shapeQuads, propertyShape, SH_MIN_COUNT) || 0);
  const minLength = Number(getFirstQuadObjectValue(shapeQuads, propertyShape, SH_MIN_LENGTH) || 0);

  if (!path || (!minCount && !minLength)) {
    return '';
  }

  const values = dataQuads
    .filter((item) => item.subject.equals(subject) && item.predicate.value === path)
    .map((item) => item.object);
  const label = getPreferredQuadLiteral(shapeQuads, propertyShape, SH_NAME) || findFieldLabelFromPath(path);
  const description = getPreferredQuadLiteral(shapeQuads, propertyShape, SH_DESCRIPTION);
  const defaultValue = getFirstQuadObjectValue(shapeQuads, propertyShape, SH_DEFAULT_VALUE);
  const issueParts = [];

  if (minCount && values.length < minCount) {
    issueParts.push(minCount === 1
      ? `${label} is required`
      : `${label} requires at least ${minCount} values, currently ${values.length}`);
  }

  if (minLength) {
    const shortestValue = values
      .filter((value) => value.termType === 'Literal')
      .map((value) => String(value.value ?? ''))
      .find((value) => value.length < minLength);

    if (!values.length && !minCount) {
      issueParts.push(`${label} must be at least ${minLength} characters`);
    } else if (shortestValue !== undefined) {
      issueParts.push(`${label} must be at least ${minLength} characters, currently ${shortestValue.length}`);
    }
  }

  if (!issueParts.length) {
    return '';
  }

  const contextParts = [];
  if (description) {
    contextParts.push(description);
  }
  if (defaultValue && !values.length) {
    contextParts.push(`default: ${defaultValue}`);
  }

  return contextParts.length
    ? `${issueParts.join('; ')}; ${contextParts.join('; ')}`
    : issueParts.join('; ');
}

function resolveShapeTerm(quads, shape) {
  if (quads.some((item) => item.subject.equals(shape))) {
    return shape;
  }

  const suffix = shape.value.split(/[\/#:]/).filter(Boolean).at(-1);
  const matchingSubject = quads.find((item) => item.subject.value.split(/[\/#:]/).filter(Boolean).at(-1) === suffix)?.subject;
  return matchingSubject || shape;
}

function describeRequiredPropertyShape(quads, propertyShape) {
  const minCount = Number(getFirstQuadObjectValue(quads, propertyShape, SH_MIN_COUNT) || 0);
  const minLength = Number(getFirstQuadObjectValue(quads, propertyShape, SH_MIN_LENGTH) || 0);

  if (!minCount && !minLength) {
    return '';
  }

  const label = getPreferredQuadLiteral(quads, propertyShape, SH_NAME) ||
    findFieldLabelFromPath(getFirstQuadObjectValue(quads, propertyShape, SH_PATH));
  const description = getPreferredQuadLiteral(quads, propertyShape, SH_DESCRIPTION);
  const defaultValue = getFirstQuadObjectValue(quads, propertyShape, SH_DEFAULT_VALUE);
  const parts = [];

  if (minCount > 1) {
    parts.push(`at least ${minCount} values`);
  } else if (minCount === 1) {
    parts.push('required');
  }

  if (minLength > 0) {
    parts.push(`minimum ${minLength} characters`);
  }

  if (defaultValue) {
    parts.push(`default: ${defaultValue}`);
  }

  return description
    ? `${label}: ${description} (${parts.join(', ')})`
    : `${label} (${parts.join(', ')})`;
}

function getPreferredQuadLiteral(quads, subject, predicateValue, preferredLanguage = 'en') {
  const values = quads
    .filter((item) => item.subject.equals(subject) && item.predicate.value === predicateValue && item.object.termType === 'Literal')
    .map((item) => item.object);
  const preferred = values.find((item) => item.language === preferredLanguage);
  const english = values.find((item) => item.language === 'en');
  const untagged = values.find((item) => !item.language);
  return (preferred || english || untagged || values[0])?.value || '';
}

function getFirstQuadObjectValue(quads, subject, predicateValue) {
  return quads.find((item) => item.subject.equals(subject) && item.predicate.value === predicateValue)?.object.value || '';
}

function getValidationResultDetails(result) {
  const constraint = result.constraintComponent?.value || result.constraintComponent?.id || '';
  const value = result.value?.value || result.value?.term?.value || result.valueOrNode?.value || '';

  if (constraint === SH_MIN_LENGTH_CONSTRAINT && typeof value === 'string' && result.args?.minLength) {
    return ` Current length: ${value.length}/${result.args.minLength}.`;
  }

  return '';
}

function collectFormValidationMessages(formElement) {
  const root = getFormRoot(formElement);
  const messages = [];

  for (const marker of root.querySelectorAll('.validation-error')) {
    const rawMessage = marker.getAttribute('title')?.trim();

    if (!rawMessage) {
      continue;
    }

    const element = marker.closest('[data-path]');
    const label = element ? findFieldLabel(element, element.dataset.path) : '';
    const message = normalizeValidationMessage(rawMessage, {
      formElement,
      label,
      path: element?.dataset.path || '',
    });
    messages.push(label && !message.startsWith(label) && !message.includes(' is incomplete.') ? `${label}: ${message}` : message);
  }

  return messages;
}

function normalizeValidationMessage(message, { formElement = null, label = '', path = '' } = {}) {
  if (isQualifiedShapeCountMessage(message)) {
    return describeQualifiedShapeCountMessage(message, { formElement, label, path });
  }

  return message;
}

function describeQualifiedShapeCountMessage(message, { formElement = null, label = '', path = '' } = {}) {
  const shapeDescription = describeShapeRestrictionsFromMessage(formElement, message, label);

  if (shapeDescription) {
    return shapeDescription;
  }

  return describeQualifiedSectionConstraint(label, path, formElement);
}

function isQualifiedShapeCountMessage(message) {
  return /\bLess than \d+ values? ha(?:s|ve) shape\b/i.test(message) ||
    /\bLes[ s]? tha[nt] \d+ values? ha(?:s|ve) shape\b/i.test(message) ||
    /\bLess tha[nt] \d+ values? ha(?:s|ve) shape\b/i.test(message);
}

function getFormMemoryContextKey(profile, resource) {
  if (profile?.shapes) {
    return `shapes:${hashString(profile.shapes)}`;
  }

  const profileKey = profile?.baseUri || resource?.applicationProfileUri;

  if (!profileKey) {
    return '';
  }

  return `${profileKey}`;
}

function getRememberedValuesSubject(contextKey) {
  return contextKey ? `urn:coscine-upload:form-memory:${hashString(contextKey)}` : '';
}

function readFormMemoryStore() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FORM_MEMORY_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeFormMemoryStore(store) {
  try {
    window.localStorage.setItem(FORM_MEMORY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Browser storage can be unavailable in private modes or strict settings.
  }
}

function readRememberedFieldSelection(contextKey, profile) {
  if (!contextKey) {
    return [];
  }

  const context = readFormMemoryContext(contextKey, profile);
  return Array.isArray(context?.selectedPaths) ? context.selectedPaths : [];
}

function writeRememberedFieldSelection(contextKey, selectedPaths) {
  if (!contextKey) {
    return;
  }

  const store = readFormMemoryStore();
  store[contextKey] = {
    ...(store[contextKey] ?? {}),
    selectedPaths,
  };
  writeFormMemoryStore(store);
}

function saveRememberedFormFields({ contextKey, fieldPaths, fields, metadataContent, profile }) {
  if (!contextKey) {
    return;
  }

  if (!fieldPaths.length) {
    const store = readFormMemoryStore();
    store[contextKey] = {
      ...(store[contextKey] ?? {}),
      fields: {},
      rememberedMetadataContent: '',
      profileBaseUri: profile?.baseUri || '',
      selectedPaths: [],
      updatedAt: new Date().toISOString(),
    };
    writeFormMemoryStore(store);
    return;
  }

  if (!String(metadataContent ?? '').trim()) {
    return;
  }

  try {
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(metadataContent);
    const rootSubject = findRootMetadataSubject(quads);
    const selectedPathSet = new Set(fieldPaths);
    const fieldLabels = new Map(fields.map((field) => [field.path, field.label]));
    const rememberedFields = {};
    const rememberedQuads = normalizeRememberedRootSubject(
      filterRememberedQuads(quads, selectedPathSet, rootSubject, profile),
      rootSubject,
      contextKey,
      profile,
    );

    for (const path of fieldPaths) {
      const values = quads
        .filter((item) => item.predicate.value === path)
        .map((item) => serializeTerm(item.object));

      if (values.length) {
        rememberedFields[path] = {
          label: fieldLabels.get(path) || findFieldLabelFromPath(path),
          values,
        };
      }
    }

    const store = readFormMemoryStore();
    store[contextKey] = {
      fields: rememberedFields,
      rememberedMetadataContent: rememberedQuads.length ? serializeQuadsSync(rememberedQuads) : '',
      profileBaseUri: profile?.baseUri || '',
      selectedPaths: fieldPaths,
      updatedAt: new Date().toISOString(),
    };
    writeFormMemoryStore(store);
  } catch {
  }
}

function buildRememberedMetadataContent(contextKey, profile) {
  if (!contextKey) {
    return '';
  }

  const context = readFormMemoryContext(contextKey, profile);
  const fields = context?.fields;
  const selectedPaths = Array.isArray(context?.selectedPaths) ? context.selectedPaths : [];

  if (!selectedPaths.length) {
    return '';
  }

  if (String(context?.rememberedMetadataContent ?? '').trim()) {
    return normalizeRememberedMetadataContent(context.rememberedMetadataContent, contextKey, profile);
  }

  if (!fields || typeof fields !== 'object') {
    return '';
  }

  try {
    const subject = namedNode(`urn:coscine-upload:form-memory:${hashString(contextKey)}`);
    const quads = [];
    const selectedPathSet = new Set(selectedPaths);

    if (profile?.baseUri) {
      quads.push(quad(subject, namedNode(DCTERMS_CONFORMS_TO), namedNode(profile.baseUri)));
    }

    for (const [path, field] of Object.entries(fields)) {
      if (!selectedPathSet.has(path)) {
        continue;
      }

      for (const value of field.values ?? []) {
        const term = deserializeTerm(value);

        if (term) {
          quads.push(quad(subject, namedNode(path), term));
        }
      }
    }

    if (!quads.length) {
      return '';
    }

    const writer = new Writer({ format: 'text/turtle' });
    writer.addQuads(quads);
    let result = '';
    writer.end((error, serialized) => {
      if (error) {
        throw error;
      }

      result = serialized;
    });
    return result;
  } catch {
    return '';
  }
}

function clearRememberedFormFields(contextKey) {
  if (!contextKey) {
    return;
  }

  const store = readFormMemoryStore();
  delete store[contextKey];
  writeFormMemoryStore(store);
}

function readFormMemoryContext(contextKey, profile) {
  const store = readFormMemoryStore();

  if (store[contextKey]) {
    return store[contextKey];
  }

  if (!contextKey.startsWith('shapes:')) {
    return null;
  }

  const profileFieldPaths = getProfileFieldPaths(profile);

  return Object.entries(store)
    .filter(([key, value]) => {
      if (key === contextKey || !value || (!value.rememberedMetadataContent && !value.fields)) {
        return false;
      }

      const selectedPaths = Array.isArray(value.selectedPaths) ? value.selectedPaths : [];
      return selectedPaths.some((path) => profileFieldPaths.has(path));
    })
    .sort((left, right) => String(right[1].updatedAt || '').localeCompare(String(left[1].updatedAt || '')))
    .map(([, value]) => value)[0] ?? null;
}

function getProfileFieldPaths(profile) {
  if (!profile?.shapes) {
    return new Set();
  }

  try {
    const parser = new Parser({ format: 'text/turtle' });
    return new Set(
      parser
        .parse(profile.shapes)
        .filter((item) => item.predicate.value === SH_PATH && item.object.termType === 'NamedNode')
        .map((item) => item.object.value),
    );
  } catch {
    return new Set();
  }
}

function findRootMetadataSubject(quads) {
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
  return candidates[0] ?? null;
}

function filterRememberedQuads(quads, selectedPathSet, rootSubject, profile) {
  const included = new Map();
  const selectedQuads = quads.filter((item) => selectedPathSet.has(item.predicate.value));

  for (const item of selectedQuads) {
    includeQuad(included, item);
    includeNestedValueQuads(included, quads, item.object);
    includeAncestorQuads(included, quads, item.subject, rootSubject);
  }

  if (rootSubject && profile?.baseUri) {
    includeQuad(included, quad(rootSubject, namedNode(DCTERMS_CONFORMS_TO), namedNode(profile.baseUri)));
  }

  return Array.from(included.values());
}

function normalizeRememberedMetadataContent(metadataContent, contextKey, profile) {
  try {
    const parser = new Parser({ format: 'text/turtle' });
    const quads = parser.parse(metadataContent);
    const rootSubject = findRootMetadataSubject(quads);
    return serializeQuadsSync(normalizeRememberedRootSubject(quads, rootSubject, contextKey, profile));
  } catch {
    return metadataContent;
  }
}

function normalizeRememberedRootSubject(quads, rootSubject, contextKey, profile) {
  const rememberedSubject = namedNode(getRememberedValuesSubject(contextKey));
  const normalizedQuads = quads.map((item) =>
    quad(
      rootSubject?.equals(item.subject) ? rememberedSubject : item.subject,
      item.predicate,
      rootSubject?.equals(item.object) ? rememberedSubject : item.object,
      item.graph,
    ),
  );

  if (profile?.baseUri) {
    const hasConformsTo = normalizedQuads.some(
      (item) =>
        item.subject.equals(rememberedSubject) &&
        item.predicate.value === DCTERMS_CONFORMS_TO &&
        item.object.termType === 'NamedNode' &&
        item.object.value === profile.baseUri,
    );

    if (!hasConformsTo) {
      normalizedQuads.push(quad(rememberedSubject, namedNode(DCTERMS_CONFORMS_TO), namedNode(profile.baseUri)));
    }
  }

  return normalizedQuads;
}

function includeAncestorQuads(included, quads, subject, rootSubject, visited = new Set()) {
  if (!subject || rootSubject?.equals(subject) || visited.has(subject.id)) {
    return;
  }

  visited.add(subject.id);

  for (const item of quads) {
    if (!item.object.equals(subject)) {
      continue;
    }

    includeQuad(included, item);
    includeAncestorQuads(included, quads, item.subject, rootSubject, visited);
  }
}

function includeNestedValueQuads(included, quads, object, visited = new Set()) {
  if (!object || object.termType === 'Literal' || visited.has(object.id)) {
    return;
  }

  visited.add(object.id);

  for (const item of quads) {
    if (!item.subject.equals(object)) {
      continue;
    }

    includeQuad(included, item);
    includeNestedValueQuads(included, quads, item.object, visited);
  }
}

function includeQuad(included, item) {
  included.set(
    `${item.subject.id} ${item.predicate.id} ${item.object.id} ${item.graph.id}`,
    item,
  );
}

function serializeQuadsSync(quads) {
  const writer = new Writer({ format: 'text/turtle' });
  writer.addQuads(quads);
  let result = '';
  writer.end((error, serialized) => {
    if (error) {
      throw error;
    }

    result = serialized;
  });
  return result;
}

function serializeTerm(term) {
  return {
    datatype: term.datatype?.value || '',
    language: term.language || '',
    termType: term.termType,
    value: term.value,
  };
}

function deserializeTerm(serializedTerm) {
  if (!serializedTerm || typeof serializedTerm !== 'object') {
    return null;
  }

  if (serializedTerm.termType === 'NamedNode') {
    return namedNode(serializedTerm.value);
  }

  if (serializedTerm.termType === 'Literal') {
    if (serializedTerm.language) {
      return literal(serializedTerm.value, serializedTerm.language);
    }

    return serializedTerm.datatype
      ? literal(serializedTerm.value, namedNode(serializedTerm.datatype))
      : literal(serializedTerm.value);
  }

  return null;
}

function findFieldLabelFromPath(path) {
  return path.split(/[\/#]/).filter(Boolean).at(-1) || path;
}

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(16);
}

function hideShaclFormSubmitButton(formElement) {
  const applyStyles = () => {
    const root = formElement.shadowRoot ?? formElement;
    const overrideCss = `
      button[type="submit"],
      input[type="submit"],
      [part="submit-button"],
      .submit-button {
        display: none !important;
      }

      .property-instance.valid::before,
      .property-instance.validation-ok-field::before {
        content: none !important;
        display: none !important;
        background: none !important;
      }
    `;

    if (root.adoptedStyleSheets) {
      if (!formElement.__coscineUploadOverrideSheet) {
        formElement.__coscineUploadOverrideSheet = new CSSStyleSheet();
      }

      formElement.__coscineUploadOverrideSheet.replaceSync(overrideCss);

      if (!root.adoptedStyleSheets.includes(formElement.__coscineUploadOverrideSheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, formElement.__coscineUploadOverrideSheet];
      }
    }

    let style = root.querySelector('#coscine-upload-hide-submit');
    if (!style) {
      style = document.createElement('style');
      style.id = 'coscine-upload-hide-submit';
      root.appendChild(style);
    }

    style.textContent = `
      ${overrideCss}

      .validation-ok {
        position: absolute;
        left: -1.15em;
        top: 0.15em;
        display: inline-block;
        margin: 0;
        color: #15803d;
        font-weight: 800;
        line-height: 1;
        white-space: nowrap;
        pointer-events: none;
      }

      .validation-ok-invalid {
        color: #b91c1c;
      }

      .validation-ok-label {
        position: relative !important;
      }

      .memory-inline-control {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        max-width: 100%;
        margin: 0 0 2px;
        border: 0;
        border-radius: 3px;
        padding: 0;
        color: #35516f;
        background: transparent;
      }

      .memory-has-inline-control {
        display: grid !important;
        grid-template-columns: minmax(0, 7%) minmax(0, 1fr);
        column-gap: 6px;
        align-items: start;
      }

      .memory-has-inline-control > :not(.memory-inline-control) {
        grid-column: 2;
        min-width: 0;
      }

      .memory-has-inline-control > .memory-inline-control {
        grid-column: 1;
        justify-self: start;
      }

      .memory-inline-control:has(input:checked) {
        background: #eef7ff;
      }

      .memory-inline-control input {
        width: 14px;
        min-height: 14px;
        margin: 0;
      }
    `;
  };

  applyStyles();
  formElement.addEventListener('ready', applyStyles);
  window.setTimeout(applyStyles, 0);
}

function syncValidationIndicators(formElement, validationReport) {
  const root = formElement.shadowRoot ?? formElement;
  if (arguments.length > 1) {
    formElement.__coscineUploadLastValidationReport = validationReport;
  }

  const activeValidationReport = arguments.length > 1
    ? validationReport
    : formElement.__coscineUploadLastValidationReport;
  const invalidPaths = getInvalidValidationPaths(activeValidationReport);
  const hasValidationReport = Array.isArray(activeValidationReport?.results);

  for (const propertyInstance of root.querySelectorAll('.property-instance[data-path]')) {
    const field = getDirectPropertyField(propertyInstance);
    const editor = getDirectPropertyEditor(propertyInstance, field);
    const directLabel = propertyInstance.querySelector(':scope > label');
    const markerField = directLabel ? propertyInstance : field;
    const label = directLabel ?? field?.querySelector(':scope > label');

    directLabel?.querySelectorAll(':scope > .validation-ok').forEach((node) => node.remove());
    if (label) {
      label.classList.remove('validation-ok-label');
    }

    if (markerField?.previousElementSibling?.classList?.contains('validation-ok')) {
      markerField.previousElementSibling.remove();
    }

    if (markerField === propertyInstance) {
      propertyInstance.querySelectorAll(':scope > .validation-ok').forEach((node) => node.remove());
    }

    const hasDirectEditor = Boolean(editor && propertyInstance.contains(editor) && editor.closest('.property-instance') === propertyInstance);
    const hasFilledDirectEditor = hasDirectEditor && isFilledEditor(editor);

    const path = propertyInstance.dataset.path || '';
    const isInvalidByReport = hasValidationReport && invalidPaths.has(path);
    const isInvalidByFieldClass = (
      propertyInstance.classList.contains('invalid') ||
      field?.classList?.contains('invalid') ||
      editor?.classList?.contains('invalid')
    );
    const isInvalid = isInvalidByReport || isInvalidByFieldClass;

    const isValidByReport = hasValidationReport && hasFilledDirectEditor && !isInvalid;
    const isValidByFormClass = propertyInstance.classList.contains('valid') || field?.classList?.contains('valid');
    if (isInvalid) {
      const badge = document.createElement('span');
      badge.className = 'validation-ok validation-ok-invalid';
      badge.textContent = '!';
      badge.setAttribute('aria-hidden', 'true');

      if (markerField && label) {
        if (label.querySelector(':scope > .validation-ok')) {
          continue;
        }
        label.classList.add('validation-ok-label');
        label.insertBefore(badge, label.firstChild);
      } else if (markerField) {
        if (markerField.previousElementSibling?.classList?.contains('validation-ok')) {
          continue;
        }
        markerField.insertAdjacentElement('beforebegin', badge);
      } else if (!propertyInstance.querySelector(':scope > .validation-ok')) {
        propertyInstance.insertAdjacentElement('afterbegin', badge);
      }
      continue;
    }

    if (!hasDirectEditor || !hasFilledDirectEditor || (!isValidByReport && !isValidByFormClass)) {
      continue;
    }

    const badge = document.createElement('span');
    badge.className = 'validation-ok';
    badge.textContent = '✓';
    badge.setAttribute('aria-hidden', 'true');

    if (markerField && label) {
      if (label.querySelector(':scope > .validation-ok')) {
        continue;
      }
      label.classList.add('validation-ok-label');
      label.insertBefore(badge, label.firstChild);
    } else if (markerField) {
      if (markerField.previousElementSibling?.classList?.contains('validation-ok')) {
        continue;
      }
      markerField.insertAdjacentElement('beforebegin', badge);
    } else {
      if (propertyInstance.querySelector(':scope > .validation-ok')) {
        continue;
      }
      propertyInstance.insertAdjacentElement('afterbegin', badge);
    }
  }
}

function getDirectPropertyField(propertyInstance) {
  return propertyInstance.querySelector(':scope > [part~="field"], :scope > .field') || propertyInstance;
}

function getDirectPropertyEditor(propertyInstance, field = getDirectPropertyField(propertyInstance)) {
  return propertyInstance.querySelector(':scope > .editor') || field?.querySelector?.(':scope > .editor') || null;
}

function getInvalidValidationPaths(validationReport) {
  const results = collectValidationResults(validationReport);
  return new Set(results.map(getValidationResultPath).filter(Boolean));
}

function collectValidationResults(validationReport) {
  const results = [];
  const stack = Array.isArray(validationReport?.results) ? [...validationReport.results] : [];

  while (stack.length) {
    const result = stack.shift();
    if (!result || typeof result !== 'object') {
      continue;
    }

    results.push(result);

    if (Array.isArray(result.results) && result.results.length) {
      stack.unshift(...result.results);
    }
  }

  return results;
}

function isFilledEditor(editor) {
  if (!editor) {
    return false;
  }

  if (editor.type === 'checkbox') {
    return Boolean(editor.checked);
  }

  if (editor.type === 'file') {
    return Boolean(editor.files?.length || editor.binaryData);
  }

  if (editor.tagName === 'SELECT') {
    return String(editor.value ?? '').trim() !== '';
  }

  return String(editor.value ?? '').trim() !== '';
}

function groupResourcesByProject(resources) {
  const projects = new Map();

  for (const resource of resources) {
    const id = resource.projectId;
    const currentProject = projects.get(id) ?? {
      id,
      name: resource.projectName || id,
      resources: [],
    };

    currentProject.resources.push(resource);
    projects.set(id, currentProject);
  }

  return Array.from(projects.values());
}

function resourceKey(resource) {
  return `${resource.projectId}:${resource.resourceId}`;
}

function resourceNameFromFileName(fileName) {
  return String(fileName ?? '').replace(/_+/g, ' ').trim();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return 'n/a';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const rootElement = document.getElementById('root');
rootElement.__coscineUploadRoot ??= createRoot(rootElement);
rootElement.__coscineUploadRoot.render(<App />);
