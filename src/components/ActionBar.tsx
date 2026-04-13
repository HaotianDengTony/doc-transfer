interface Props {
  appState: 'ready' | 'generating' | 'done';
  onGenerate: () => void;
  downloadUrl: string | null;
  downloadFileName: string;
}

export function ActionBar({ appState, onGenerate, downloadUrl, downloadFileName }: Props) {
  return (
    <div className="action-bar">
      {/* Status text */}
      <span
        className={`action-bar__status${appState === 'done' ? ' action-bar__status--done' : ''}`}
      >
        {appState === 'ready' && 'Ready to generate. Manual input fields are optional.'}
        {appState === 'generating' && 'Generating document…'}
        {appState === 'done' && 'Document generated successfully.'}
      </span>

      {/* Generate button (visible in ready + generating states) */}
      {appState !== 'done' && (
        <button
          className="btn btn--orange"
          onClick={onGenerate}
          disabled={appState === 'generating'}
        >
          {appState === 'generating' && <span className="spinner--sm" />}
          {appState === 'generating' ? 'Generating…' : 'Generate Document'}
        </button>
      )}

      {/* Download button + Regenerate option (visible in done state) */}
      {appState === 'done' && downloadUrl && (
        <>
          <a
            className="btn btn--green"
            href={downloadUrl}
            download={downloadFileName}
          >
            Download .docx
          </a>
          <button
            className="btn btn--ghost"
            onClick={onGenerate}
          >
            Regenerate
          </button>
        </>
      )}
    </div>
  );
}
