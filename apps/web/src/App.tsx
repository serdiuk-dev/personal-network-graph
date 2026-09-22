import { useState } from 'react';
import { NetworkGraph } from './components/NetworkGraph';
import { PeopleManager } from './components/PeopleManager';

type View = 'graph' | 'people';

function App() {
  const [view, setView] = useState<View>('graph');

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
      </nav>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow:
            view === 'people' ? 'auto' : 'hidden',
        }}
      >
        {view === 'graph' ? (
          <NetworkGraph />
        ) : (
          <PeopleManager />
        )}
      </div>
    </div>
  );
}

export default App;
