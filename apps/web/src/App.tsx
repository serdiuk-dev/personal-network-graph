import { useState } from 'react';
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

function App() {
  const [view, setView] = useState<View>('graph');
  const [graphVersion, setGraphVersion] = useState(0);
  const [peopleFocusId, setPeopleFocusId] =
    useState<string | null>(null);

  function notifyGraphChanged() {
    setGraphVersion((version) => version + 1);
  }

  function openPersonFromReminder(personId: string) {
    setPeopleFocusId(personId);
    setView('people');
  }

  return (
    <div className="pnet-app">
      <nav className="pnet-nav">
        <strong className="pnet-brand">
          Personal Network
        </strong>

        <button
          type="button"
          onClick={() => setView('graph')}
          disabled={view === 'graph'}
        >
          Graph
        </button>

        <button
          type="button"
          onClick={() => setView('overview')}
          disabled={view === 'overview'}
        >
          Overview
        </button>

        <button
          type="button"
          onClick={() => setView('people')}
          disabled={view === 'people'}
        >
          People
        </button>

        <button
          type="button"
          onClick={() => setView('reminders')}
          disabled={view === 'reminders'}
        >
          Reminders
        </button>

        <button
          type="button"
          onClick={() => setView('relationships')}
          disabled={view === 'relationships'}
        >
          Relationships
        </button>

        <button
          type="button"
          onClick={() => setView('edgeStyles')}
          disabled={view === 'edgeStyles'}
        >
          Edge Styles
        </button>

        <button
          type="button"
          onClick={() => setView('graphStyles')}
          disabled={view === 'graphStyles'}
        >
          Graph Styles
        </button>

        <button
          type="button"
          onClick={() => setView('taxonomy')}
          disabled={view === 'taxonomy'}
        >
          Categories / Interests
        </button>
      </nav>

      <div className="pnet-content">
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
      </div>
    </div>
  );
}

export default App;
