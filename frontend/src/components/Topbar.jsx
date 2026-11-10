import LanguageSelector from './LanguageSelector';

export default function Topbar({ title, children }) {
  return (
    <header className="topbar">
      <h2>{title}</h2>
      <div className="actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {children}
        <div className="topbar-lang-selector">
          <LanguageSelector />
        </div>
      </div>
    </header>
  );
}
