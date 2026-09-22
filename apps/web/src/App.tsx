import { useState } from 'react';
import { NetworkGraph } from './components/NetworkGraph';
import { PeopleManager } from './components/PeopleManager';
import { RelationshipsManager } from './components/RelationshipsManager';
import { TaxonomyManager } from './components/TaxonomyManager';

type View =
  | 'graph'
  | 'people'
  | 'relationships'
  | 'taxonomy';

function App() {
  const [view, setView] = useState<View>('graph');
  const [graphVersion, setGraphVersion] = useState(0);

  function notifyGraphChanged() {
    setGraphVersion((version) => version + 1);
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <nav
        style={{
          height: '52px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '0 18px',
          borderBottom: '1px solid #ddd',
          fontFamily: 'sans-serif',
        }}
      >
        <strong style={{ marginRight: '20px' }}>
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
          onClick={() => setView('people')}
          disabled={view === 'people'}
        >
          People
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
          onClick={() => setView('taxonomy')}
          disabled={view === 'taxonomy'}
        >
          Categories / Interests
        </button>
      </nav>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: view === 'graph' ? 'hidden' : 'auto',
        }}
      >
        {view === 'graph' && (
          <NetworkGraph refreshKey={graphVersion} />
        )}

        {view === 'people' && (
          <PeopleManager onChanged={notifyGraphChanged} />
        )}

        {view === 'relationships' && (
          <RelationshipsManager
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
