import { SignOutButton } from './auth/AuthBoundary';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NetworkGraph } from './components/NetworkGraph';
import { NetworkOverview } from './components/NetworkOverview';
import { PeopleManager, type ContactDraft } from './components/PeopleManager';
import { RelationshipsManager } from './components/RelationshipsManager';
import { RemindersDashboard } from './components/RemindersDashboard';
import { RelationshipStyleManager } from './components/RelationshipStyleManager';
import { GraphStyleManager, type GraphStyleSettings } from './components/GraphStyleManager';
import { TaxonomyManager } from './components/TaxonomyManager';
import { appearanceDefaults, readAppearance, type Appearance, type ThemeMode } from './graph/appearance';

type Panel = 'filters' | 'overview' | 'people' | 'reminders' | 'relationships' | 'edgeStyles' | 'graphStyles' | 'taxonomy' | 'appearance' | 'contact' | 'account';
const labels: Record<Panel, string> = { filters: 'Search & filters', overview: 'Network overview', people: 'Contacts', reminders: 'Events & reminders', relationships: 'Connections', edgeStyles: 'Relationship styles', graphStyles: 'Circles & connections', taxonomy: 'Categories & interests', appearance: 'Graph appearance', contact: 'Contact overview', account: 'Account' };
const groups: { label: string; panels: Panel[] }[] = [
  { label: 'Network', panels: ['people', 'relationships', 'taxonomy'] },
  { label: 'Activity', panels: ['reminders'] },
  { label: 'View', panels: ['appearance', 'graphStyles', 'edgeStyles', 'filters'] },
  { label: 'More', panels: ['overview', 'account'] },
];
function App() {
  const [panel, setPanel] = useState<Panel>('appearance');
  const [open, setOpen] = useState(true);
  const [menu, setMenu] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => { try { return localStorage.getItem('pnet-theme-v1') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [preferences, setPreferences] = useState(() => ({ light: readAppearance('light'), dark: readAppearance('dark') }));
  const [storageError, setStorageError] = useState('');
  const [graphVersion, setGraphVersion] = useState(0);
  const [contactDraft, setContactDraft] = useState<ContactDraft | null>(null);
  const [preview, setPreview] = useState<GraphStyleSettings | null>(null);
  const [peopleFocusId, setPeopleFocusId] = useState<string | null>(null);
  const [createKey, setCreateKey] = useState(0);
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const graphRegion = useRef<HTMLDivElement>(null);
  const dirty = useRef(false);
  const trigger = useRef<HTMLElement | null>(null);
  const appearance = preferences[theme];
  useEffect(() => {
    try { localStorage.setItem('pnet-theme-v1', theme); localStorage.setItem(`pnet-appearance-v1-${theme}`, JSON.stringify(appearance)); setStorageError(''); }
    catch { setStorageError('Appearance works for this session; browser storage is unavailable.'); }
  }, [theme, appearance]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!navRef.current?.contains(event.target as Node)) setMenu(null); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  useEffect(() => { document.title = 'Personal Network'; }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, []);
  const changePanel = useCallback((next: Panel) => {
    if (next !== panel && dirty.current && !window.confirm('Leave this panel and discard unsaved edits?')) return false;
    if (next !== panel) { dirty.current = false; setPreview(null); setContactDraft(null); }
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPanel(next); setOpen(true); setMenu(null);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    return true;
  }, [panel]);
  const showContact = useCallback(() => { changePanel('contact'); }, [changePanel]);
  const changed = useCallback(() => { dirty.current = false; setGraphVersion(v => v + 1); }, []);
  function editAppearance(key: keyof Appearance, value: string | number) {
    setPreferences(current => ({ ...current, [theme]: { ...current[theme], [key]: value } }));
  }
  function hidePanel() { setOpen(false); trigger.current?.focus({ preventScroll: true }); }
  return <div className="pnet-app pnet-workspace" data-theme={theme}>
    <a className="pnet-skip-link" href="#pnet-content">Skip to graph</a>
    <header className="pnet-header">
      <nav aria-label="Main navigation" ref={navRef} onKeyDown={event => { if (event.key === 'Escape') { setMenu(null); (navRef.current?.querySelector('[aria-expanded="true"]') as HTMLElement)?.focus(); } }}>
        {groups.map(group => <div className="pnet-menu" key={group.label}>
          <button type="button" aria-expanded={menu === group.label} aria-controls={`menu-${group.label}`} onClick={() => setMenu(menu === group.label ? null : group.label)}>{group.label} <span aria-hidden="true">⌄</span></button>
          {menu === group.label && <div className="pnet-dropdown" id={`menu-${group.label}`}>
            {group.panels.map(item => <button type="button" key={item} aria-current={open && panel === item ? 'true' : undefined} onClick={() => changePanel(item)}>{labels[item]}</button>)}
          </div>}
        </div>)}
      </nav>
      <div className="pnet-header-actions">
        <button type="button" aria-label="Filters" onClick={() => changePanel('filters')}><svg className="pnet-filter-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4 2v-8Z" /></svg><span className="pnet-filter-label">Filters</span></button>
        <button type="button" aria-label="Events and reminders" title="Events and reminders" onClick={() => changePanel('reminders')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></button>
        <button type="button" aria-label={open ? 'Hide right panel' : 'Show right panel'} aria-expanded={open} aria-controls="pnet-right-panel" onClick={() => setOpen(v => !v)}>◧</button>
        <button type="button" className="pnet-primary" onClick={() => {
          if (panel === 'people' && dirty.current && !window.confirm('Discard unsaved contact edits and start a new contact?')) return;
          if (changePanel('people')) { dirty.current = false; setCreateKey(k => k + 1); }
        }}>+ Contact</button>
        <div className="pnet-theme-switch" aria-label="Colour theme">
          <button type="button" aria-label="Light theme" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>☀</button>
          <button type="button" aria-label="Dark theme" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>☾</button>
        </div>
      </div>
    </header>
    <main id="pnet-content" className="pnet-work-area" tabIndex={-1}>
      <div className="pnet-main-graph" ref={graphRegion}>
        <NetworkGraph refreshKey={graphVersion} panelTarget={target} activePanel={panel} onSelectContact={showContact} appearance={appearance} previewStyles={preview} contactDraft={contactDraft} />
      </div>
      <aside id="pnet-right-panel" className="pnet-right-panel" hidden={!open} aria-label={labels[panel]}>
        <div className="pnet-panel-heading"><h2 ref={headingRef} tabIndex={-1}>{labels[panel]}</h2><button type="button" aria-label="Close right panel" onClick={hidePanel}>×</button></div>
        <div className="pnet-panel-scroll" onChangeCapture={event => { if ((event.target as HTMLElement).closest('[data-editor]')) dirty.current = true; }}>
          <div ref={setTarget} />
          {panel === 'appearance' && <section className="pnet-appearance">
            <p>Live preview · saved in this browser for each theme.</p>
            {(['text', 'secondary', 'selected', 'inactive', 'accentA', 'accentB'] as const).map((key, index) => <label key={key}>{['Main labels', 'Secondary labels', 'Selected node', 'Inactive nodes', 'Accent A · hub', 'Accent B · hub'][index]}<input type="color" value={appearance[key]} onChange={e => editAppearance(key, e.target.value)} /></label>)}
            <label>Label size: {appearance.labelSize}px<input type="range" min="10" max="26" value={appearance.labelSize} onChange={e => editAppearance('labelSize', Number(e.target.value))} /></label>
            <button type="button" onClick={() => setPreferences(current => ({ ...current, [theme]: { ...appearanceDefaults[theme] } }))}>Reset this theme</button>
            <button type="button" onClick={() => changePanel('graphStyles')}>Circles & connection colours</button>
            {storageError && <p role="status">{storageError}</p>}
          </section>}
          {panel === 'overview' && <NetworkOverview refreshKey={graphVersion} />}
          {panel === 'people' && <div data-editor><PeopleManager key={createKey} onChanged={changed} onPreview={setContactDraft} onDirtyChange={value => { dirty.current = value; }} focusPersonId={peopleFocusId} onFocusConsumed={() => setPeopleFocusId(null)} /></div>}
          {panel === 'reminders' && <div data-editor><RemindersDashboard onOpenPerson={id => { if (changePanel('people')) setPeopleFocusId(id); }} /></div>}
          {panel === 'relationships' && <div data-editor><RelationshipsManager onChanged={changed} /></div>}
          {panel === 'edgeStyles' && <div data-editor><RelationshipStyleManager onChanged={changed} /></div>}
          {panel === 'graphStyles' && <div data-editor><GraphStyleManager onChanged={changed} onPreview={setPreview} /></div>}
          {panel === 'taxonomy' && <div data-editor><TaxonomyManager onChanged={changed} /></div>}
          {panel === 'account' && <SignOutButton />}
        </div>
      </aside>
    </main>
  </div>;
}
export default App;
