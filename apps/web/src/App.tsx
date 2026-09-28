import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { NetworkGraph } from './components/NetworkGraph';
import { NetworkOverview } from './components/NetworkOverview';
import { PeopleManager } from './components/PeopleManager';
import { RelationshipsManager } from './components/RelationshipsManager';
import { RemindersDashboard } from './components/RemindersDashboard';
import { RelationshipStyleManager } from './components/RelationshipStyleManager';
import { GraphStyleManager } from './components/GraphStyleManager';
import { TaxonomyManager } from './components/TaxonomyManager';

type View =
  | 'graph'
  | 'overview'
  | 'people'
  | 'reminders'
  | 'relationships'
  | 'edgeStyles'
  | 'graphStyles'
  | 'taxonomy';

const viewLabels: Record<View, string> = {
  graph: 'Graph', overview: 'Overview', people: 'People',
  reminders: 'Reminders', relationships: 'Relationships',
  edgeStyles: 'Edge Styles', graphStyles: 'Graph Styles',
  taxonomy: 'Categories / Interests',
};

function App() {
  const [view, setView] = useState<View>('graph');
  const [graphVersion, setGraphVersion] = useState(0);
  const [peopleFocusId, setPeopleFocusId] =
    useState<string | null>(null);

  const contentRef = useRef<HTMLElement>(null);
  const focusAfterNavigation = useRef(false);

  function changeView(nextView: View) {
    if (nextView === view) return;
    focusAfterNavigation.current = true;
    setView(nextView);
  }

  useLayoutEffect(() => {
    if (focusAfterNavigation.current) {
      focusAfterNavigation.current = false;
      contentRef.current?.scrollTo({ top: 0 });
      contentRef.current?.focus({ preventScroll: true });
    }
  }, [view]);

  useEffect(() => {
    document.title = `${viewLabels[view]} — Personal Network`;
  }, [view]);

  function notifyGraphChanged() {
    setGraphVersion((version) => version + 1);
  }

  function openPersonFromReminder(personId: string) {
    setPeopleFocusId(personId);
    changeView('people');
  }

  return (
    <div className="pnet-app">
      <a className="pnet-skip-link" href="#pnet-content"
        onClick={(event) => {
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }}
      >Skip to content</a>
      <nav className="pnet-nav" aria-label="Main navigation">
        <strong className="pnet-brand">
          Personal Network
        </strong>

        <button
          type="button"
          onClick={() => changeView('graph')}
          aria-current={view === 'graph' ? 'page' : undefined}
        >
          Graph
        </button>

        <button
          type="button"
          onClick={() => changeView('overview')}
          aria-current={view === 'overview' ? 'page' : undefined}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => changeView('people')}
          aria-current={view === 'people' ? 'page' : undefined}
        >
          People
        </button>

        <button
          type="button"
          onClick={() => changeView('reminders')}
          aria-current={view === 'reminders' ? 'page' : undefined}
        >
          Reminders
        </button>

        <button
          type="button"
          onClick={() => changeView('relationships')}
          aria-current={view === 'relationships' ? 'page' : undefined}
        >
          Relationships
        </button>

        <button
          type="button"
          onClick={() => changeView('edgeStyles')}
          aria-current={view === 'edgeStyles' ? 'page' : undefined}
        >
          Edge Styles
        </button>

        <button
          type="button"
          onClick={() => changeView('graphStyles')}
          aria-current={view === 'graphStyles' ? 'page' : undefined}
        >
          Graph Styles
        </button>

        <button
          type="button"
          onClick={() => changeView('taxonomy')}
          aria-current={view === 'taxonomy' ? 'page' : undefined}
        >
          Categories / Interests
        </button>
      </nav>

      <main id="pnet-content" className="pnet-content"
        ref={contentRef} tabIndex={-1} aria-label={viewLabels[view]}
      >
        {view === 'graph' && (
          <NetworkGraph refreshKey={graphVersion} />
        )}

        {view === 'overview' && (
          <NetworkOverview
            refreshKey={graphVersion}
          />
        )}

        {view === 'people' && (
          <PeopleManager
            onChanged={notifyGraphChanged}
            focusPersonId={peopleFocusId}
            onFocusConsumed={() => setPeopleFocusId(null)}
          />
        )}

        {view === 'reminders' && (
          <RemindersDashboard
            onOpenPerson={openPersonFromReminder}
          />
        )}

        {view === 'relationships' && (
          <RelationshipsManager
            onChanged={notifyGraphChanged}
          />
        )}

        {view === 'edgeStyles' && (
          <RelationshipStyleManager
            onChanged={notifyGraphChanged}
          />
        )}

        {view === 'graphStyles' && (
          <GraphStyleManager
            onChanged={notifyGraphChanged}
          />
        )}

        {view === 'taxonomy' && (
          <TaxonomyManager
            onChanged={notifyGraphChanged}
          />
        )}
      </main>
    </div>
  );
}

export default App;
