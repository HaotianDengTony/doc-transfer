import type { ProductInfo } from '../lib/docx/types';

interface Props {
  productInfo: ProductInfo;
  warnings: string[];
}

/** Clean up a raw warning string into a short human-readable message. */
function cleanWarning(raw: string): string {
  // "Section not found: path → sub (for placeholderId)" → "Section not found: path → sub"
  const match = raw.match(/^(Section not found: .+?) \(for .+?\)$/);
  if (match) return match[1];
  return raw;
}

export function ExtractionSummary({ productInfo, warnings }: Props) {
  return (
    <div className="card">
      <div className="card-title">Extraction Summary</div>

      <table className="info-table">
        <tbody>
          <InfoRow label="Chinese name" value={productInfo.chineseProductName || '—'} />
          <InfoRow label="English name" value={productInfo.englishProductName || '—'} />
          <InfoRow label="Instrument"   value={productInfo.system || '—'} />
          <InfoRow label="Test count"   value={productInfo.testCount ? `${productInfo.testCount} tests/kit` : '—'} />
          <InfoRow label="Order code"   value={productInfo.orderCode || '—'} />
          <InfoRow label="Version"      value={productInfo.version || '—'} />
        </tbody>
      </table>

      {warnings.length > 0 && (
        <div className="warnings-box">
          <div className="warnings-box__title">Warnings — {warnings.length} section(s) missing</div>
          <ul className="warnings-box__list">
            {warnings.map((w, i) => (
              <li key={i}>{cleanWarning(w)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td>{label}</td>
      <td>{value}</td>
    </tr>
  );
}
