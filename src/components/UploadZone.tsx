import { useRef, useState } from 'react';

interface Props {
  onFileSelect: (file: File) => void;
  disabled: boolean;
  fileName?: string;
}

export function UploadZone({ onFileSelect, disabled, fileName }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.docx')) {
      onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    e.target.value = ''; // allow re-selecting the same file
  };

  const handleClick = () => {
    if (!disabled) inputRef.current?.click();
  };

  const classes = [
    'upload-zone',
    fileName ? 'upload-zone--has-file' : '',
    dragActive ? 'upload-zone--active' : '',
    disabled ? 'upload-zone--disabled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".docx"
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {fileName ? (
        <>
          <div className="upload-zone__icon">
            <DocIcon size={32} />
          </div>
          <div className="upload-zone__file-info">
            <div className="upload-zone__filename">{fileName}</div>
            <span
              className="upload-zone__change"
              onClick={handleClick}
            >
              Click to upload a different file
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="upload-zone__icon">
            <DocIcon size={40} />
          </div>
          <div className="upload-zone__primary">Drag &amp; drop your .docx file here</div>
          <div className="upload-zone__secondary">
            or{' '}
            <span style={{ color: 'var(--orange)', fontWeight: 600, cursor: 'pointer' }} onClick={handleClick}>
              click to browse
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function DocIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}
