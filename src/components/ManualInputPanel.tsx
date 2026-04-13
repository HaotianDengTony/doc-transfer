interface Props {
  months: string;
  days: string;
  disabled: boolean;
  onChange: (field: 'months' | 'days', value: string) => void;
}

export function ManualInputPanel({ months, days, disabled, onChange }: Props) {
  return (
    <div className="card">
      <div className="card-title">Manual Inputs</div>
      <p className="card-subtitle">
        These values could not be auto-extracted. Leave blank to keep the placeholder highlighted in the output.
      </p>

      <div className="input-group">
        <label htmlFor="input-months">Validity period</label>
        <div className="input-with-unit">
          <input
            id="input-months"
            type="number"
            min="1"
            max="999"
            placeholder="e.g. 24"
            value={months}
            disabled={disabled}
            onChange={(e) => onChange('months', e.target.value)}
          />
          <span className="input-unit">months</span>
        </div>
        <div className="input-hint">Shelf life from manufacture date</div>
      </div>

      <div className="input-group">
        <label htmlFor="input-days">Opened stability</label>
        <div className="input-with-unit">
          <input
            id="input-days"
            type="number"
            min="1"
            max="999"
            placeholder="e.g. 60"
            value={days}
            disabled={disabled}
            onChange={(e) => onChange('days', e.target.value)}
          />
          <span className="input-unit">days</span>
        </div>
        <div className="input-hint">Stability after first opening</div>
      </div>
    </div>
  );
}
