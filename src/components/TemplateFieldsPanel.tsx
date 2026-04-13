import { useState } from 'react';
import type { MappingResult } from '../lib/docx/types';

// ─── Field metadata ────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  'title':                    'Document Title',
  'productName.chinese':      'Product Name (Chinese)',
  'productName.english':      'Product Name (English)',
  'packageSpec':              'Package Specification',
  'intendedUse.main':         'Intended Use',
  'intendedUse.summary':      'Summary & Explanation',
  'testPrinciple':            'Test Principle',
  'components.reagentText':   'Reagent Components',
  'components.reagentTable':  'Reagent Components (table)',
  'components.notProvided':   'Materials Not Provided',
  'components.notProvidedTable': 'Materials Not Provided (table)',
  'storage.months':           'Validity Period',
  'storage.days':             'Opened Stability',
  'storage.text':             'Storage Conditions',
  'storage.onboard':          'On-board Stability',
  'instrument':               'Applicable Instruments',
  'sample.main':              'Sample Requirements',
  'sample.collection':        'Sample Collection',
  'sample.storage':           'Sample Storage',
  'sample.transport':         'Sample Transport',
  'sample.preparation':       'Sample Preparation',
  'method.steps':             'Test Procedure Steps',
  'method.reagentPrep':       'Reagent Preparation',
  'method.systemPrep':        'System Preparation',
  'method.masterCurve':       'Master Curve Definition',
  'method.calibration':       'Calibration Execution',
  'method.calibFreq':         'Calibration Frequency',
  'method.calibPrep':         'Calibrator Preparation',
  'method.calibProc':         'Calibration Procedure',
  'method.qc':                'Quality Control',
  'method.corrective':        'Corrective Actions',
  'method.results':           'Result Calculation',
  'positiveJudgment':         'Positive Judgment / Reference Range',
  'resultInterpretation':     'Result Interpretation',
  'limitations':              'Test Limitations',
  'performance':              'Performance Characteristics',
  'standardization':          'Standardization',
  'warnings':                 'Warnings & Precautions',
  'symbols':                  'Symbol Definitions',
  'references':               'References',
};

const FIELD_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Product Identity',      ids: ['title', 'productName.chinese', 'productName.english', 'packageSpec'] },
  { label: 'Intended Use',          ids: ['intendedUse.main', 'intendedUse.summary'] },
  { label: 'Test Principle',        ids: ['testPrinciple'] },
  { label: 'Main Components',       ids: ['components.reagentText', 'components.reagentTable', 'components.notProvided', 'components.notProvidedTable'] },
  { label: 'Storage & Validity',    ids: ['storage.months', 'storage.days', 'storage.text', 'storage.onboard'] },
  { label: 'Applicable Instruments',ids: ['instrument'] },
  { label: 'Sample Requirements',   ids: ['sample.main', 'sample.collection', 'sample.storage', 'sample.transport', 'sample.preparation'] },
  { label: 'Test Method',           ids: ['method.steps', 'method.reagentPrep', 'method.systemPrep', 'method.masterCurve', 'method.calibration', 'method.calibFreq', 'method.calibPrep', 'method.calibProc', 'method.qc', 'method.corrective', 'method.results'] },
  { label: 'Results & Interpretation', ids: ['positiveJudgment', 'resultInterpretation'] },
  { label: 'Limitations',           ids: ['limitations'] },
  { label: 'Performance',           ids: ['performance'] },
  { label: 'Standardization',       ids: ['standardization'] },
  { label: 'Warnings & Precautions',ids: ['warnings'] },
  { label: 'Symbols & References',  ids: ['symbols', 'references'] },
];

// ─── Status helpers ────────────────────────────────────────────────────────

type FieldStatus = 'filled' | 'manual' | 'missing';

function getStatus(id: string, result: MappingResult): FieldStatus {
  const content = result.mappings.get(id);
  if (!content) return 'missing';
  if (content.requiresManualInput) return 'manual';
  if (content.rawXmlFragments.length > 0 || content.plainText) return 'filled';
  return 'missing';
}

function getPreview(id: string, result: MappingResult): string {
  const content = result.mappings.get(id);
  if (!content) return 'Source section not found — placeholder left highlighted in output.';
  if (content.requiresManualInput) return 'Requires manual input (enter value in the Manual Inputs panel).';
  const text = content.plainText.trim();
  if (!text) return 'Section found but no text content extracted.';
  return text.length > 180 ? text.substring(0, 180) + '…' : text;
}

// ─── Component ────────────────────────────────────────────────────────────

interface Props {
  mappingResult: MappingResult;
}

export function TemplateFieldsPanel({ mappingResult }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Compute summary counts across all known fields
  let filled = 0, manual = 0, missing = 0;
  for (const group of FIELD_GROUPS) {
    for (const id of group.ids) {
      const s = getStatus(id, mappingResult);
      if (s === 'filled') filled++;
      else if (s === 'manual') manual++;
      else missing++;
    }
  }

  return (
    <div className="card">
      <div className="card-title">Template Fields</div>

      <div className="fields-stats">
        <span className="fields-stat"><span className="dot dot--green" />{filled} filled</span>
        <span className="fields-stat"><span className="dot dot--orange" />{manual} manual</span>
        <span className="fields-stat"><span className="dot dot--red" />{missing} missing</span>
      </div>

      <div className="fields-scroll">
        {FIELD_GROUPS.map((group) => (
          <div key={group.label} className="field-group">
            <div className="field-group-label">{group.label}</div>

            {group.ids.map((id) => {
              const status = getStatus(id, mappingResult);
              const preview = getPreview(id, mappingResult);
              const isOpen = expanded.has(id);

              return (
                <div key={id} className={`field-item field-item--${status}`}>
                  <div
                    className="field-item__header"
                    onClick={() => toggle(id)}
                    role="button"
                    aria-expanded={isOpen}
                  >
                    <span className={`dot dot--${status === 'filled' ? 'green' : status === 'manual' ? 'orange' : 'red'}`} />
                    <span className="field-item__label">{FIELD_LABELS[id] ?? id}</span>
                    <span className={`field-item__badge field-item__badge--${status}`}>{status}</span>
                    <span className={`field-item__chevron${isOpen ? ' field-item__chevron--open' : ''}`}>▶</span>
                  </div>

                  {isOpen && (
                    <div className={`field-item__preview field-item__preview--${status}`}>
                      {preview}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
