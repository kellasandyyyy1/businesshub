import ModesSection from './ModesSection'
import { THEMES, setTheme } from '../../hooks/useTheme'

const LABELS = {
  system: 'Follows your operating system',
  light: 'Always the light palette',
  dark: 'Always the dark palette',
}

export default function AppearanceSection({ theme }) {
  return (
    <div className="bfh-settings__body">
      <h2 className="bfh-panel__title">Appearance</h2>
      <p className="bfh-settings__note">
        The same monochrome ramp either way, dark mode re-maps the roles, it is not a
        different design.
      </p>

      <div className="bfh-themes" role="radiogroup" aria-label="Theme">
        {THEMES.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={theme === option}
            className="bfh-theme"
            onClick={() => setTheme(option)}
          >
            {/* Swatch shows the palette itself, not a description of it. */}
            <span className="bfh-theme__swatch" data-variant={option} aria-hidden="true">
              <span className="bfh-theme__bar" />
              <span className="bfh-theme__bar" data-short="true" />
            </span>
            <span className="bfh-theme__name">{option}</span>
            <span className="bfh-micro">{LABELS[option]}</span>
          </button>
        ))}
      </div>

      <ModesSection />
    </div>
  )
}
