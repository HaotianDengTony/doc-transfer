import { useState, useEffect, useRef } from 'react';
import './App.css';

import { parseSourceDocument } from './lib/parser/SourceDocumentParser';
import { mapSections } from './lib/mapping/SectionMapper';
import { generateDocument } from './lib/generator/DocxGenerator';
import type { DocxArchive, ParsedDocument, MappingResult } from './lib/docx/types';

import { UploadZone } from './components/UploadZone';
import { ExtractionSummary } from './components/ExtractionSummary';
import { ManualInputPanel } from './components/ManualInputPanel';
import { TemplateFieldsPanel } from './components/TemplateFieldsPanel';
import { ActionBar } from './components/ActionBar';

type AppState = 'idle' | 'parsing' | 'ready' | 'generating' | 'done' | 'error';

export default function App() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [fileName, setFileName] = useState('');
  const [parseResult, setParseResult] = useState<ParsedDocument | null>(null);
  const [mappingResult, setMappingResult] = useState<MappingResult | null>(null);
  const [sourceArchive, setSourceArchive] = useState<DocxArchive | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState('');
  const [months, setMonths] = useState('');
  const [days, setDays] = useState('');

  // Keep a ref to the latest download URL so we can revoke it on next upload
  const prevDownloadUrl = useRef<string | null>(null);

  // Auto-download when downloadUrl is first set
  useEffect(() => {
    if (!downloadUrl || !downloadFileName) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [downloadUrl, downloadFileName]);

  const handleFileSelect = async (file: File) => {
    // Revoke previous blob URL to free memory
    if (prevDownloadUrl.current) {
      URL.revokeObjectURL(prevDownloadUrl.current);
      prevDownloadUrl.current = null;
    }

    setFileName(file.name);
    setAppState('parsing');
    setParseResult(null);
    setMappingResult(null);
    setSourceArchive(null);
    setDownloadUrl(null);
    setDownloadFileName('');
    setErrorMessage('');

    try {
      const { archive, document: parsed } = await parseSourceDocument(file);
      const mapping = mapSections(parsed);

      setParseResult(parsed);
      setMappingResult(mapping);
      setSourceArchive(archive);
      setAppState('ready');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setAppState('error');
      console.error('Parse error:', err);
    }
  };

  const handleGenerate = async () => {
    if (!sourceArchive || !parseResult || !mappingResult) return;

    setAppState('generating');

    try {
      // Build manual inputs map (only include non-empty values)
      const manualInputs = new Map<string, string>();
      if (months.trim()) manualInputs.set('storage.months', months.trim());
      if (days.trim()) manualInputs.set('storage.days', days.trim());

      const blob = await generateDocument(
        sourceArchive,
        parseResult,
        mappingResult,
        manualInputs.size > 0 ? manualInputs : undefined,
      );

      // Revoke previous URL if regenerating
      if (prevDownloadUrl.current) {
        URL.revokeObjectURL(prevDownloadUrl.current);
      }

      const url = URL.createObjectURL(blob);
      prevDownloadUrl.current = url;

      const englishName = parseResult.productInfo.englishProductName || 'output';
      const outName = `合规说明书-${englishName}.docx`;

      setDownloadUrl(url);
      setDownloadFileName(outName);
      setAppState('done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setAppState('error');
      console.error('Generate error:', err);
    }
  };

  const handleManualChange = (field: 'months' | 'days', value: string) => {
    if (field === 'months') setMonths(value);
    else setDays(value);
  };

  const isInputDisabled = appState === 'generating';

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="app-header">
        <span className="app-header__title">Document Transfer Tool</span>
        <span className="app-header__subtitle">
          Convert Siemens product manuals to NMPA compliance format
        </span>
      </header>

      {/* ── Body ── */}
      <main className="app-body">

        {/* Upload zone — always visible */}
        <UploadZone
          onFileSelect={handleFileSelect}
          disabled={isInputDisabled}
          fileName={fileName || undefined}
        />

        {/* Parsing indicator */}
        {appState === 'parsing' && (
          <div className="parsing-indicator">
            <span className="spinner" />
            Parsing document, please wait…
          </div>
        )}

        {/* Error banner */}
        {appState === 'error' && (
          <div className="error-banner">
            <span className="error-banner__label">Error:</span>
            {errorMessage}
          </div>
        )}

        {/* Main content — shown once parsing is done */}
        {(appState === 'ready' || appState === 'generating' || appState === 'done') &&
          parseResult && mappingResult && (
          <>
            <div className="main-content">
              {/* Left column */}
              <div className="left-column">
                <ExtractionSummary
                  productInfo={parseResult.productInfo}
                  warnings={mappingResult.warnings}
                />
                <ManualInputPanel
                  months={months}
                  days={days}
                  disabled={isInputDisabled}
                  onChange={handleManualChange}
                />
              </div>

              {/* Right column */}
              <TemplateFieldsPanel mappingResult={mappingResult} />
            </div>

            {/* Action bar */}
            <ActionBar
              appState={appState === 'ready' || appState === 'generating' ? appState : 'done'}
              onGenerate={handleGenerate}
              downloadUrl={downloadUrl}
              downloadFileName={downloadFileName}
            />
          </>
        )}
      </main>
    </div>
  );
}
