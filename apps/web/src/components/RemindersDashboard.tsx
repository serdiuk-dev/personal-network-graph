import { useEffect, useState } from 'react';

type ReminderDelivery = {
  channel: 'TELEGRAM' | 'EMAIL';
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
};

type UpcomingReminder = {
  id: string;
  dueAt: string;
  completedAt: string | null;
  deliveries: ReminderDelivery[];
  event: {
    id: string;
    type: string;
    title: string;
    eventAt: string | null;
    note: string | null;
    person: {
      id: string;
      firstName: string;
      lastName: string | null;
    };
  };
};

export function RemindersDashboard() {
  const [reminders, setReminders] = useState<UpcomingReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReminders(showLoading = false) {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const response = await fetch('/api/v1/reminders/upcoming');

      if (!response.ok) {
        throw new Error(
          `Reminders API returned HTTP ${response.status}`,
        );
      }

      setReminders(await response.json());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load reminders',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadReminders(true);
  }, []);

  function status(
    reminder: UpcomingReminder,
    channel: 'TELEGRAM' | 'EMAIL',
  ) {
    return (
      reminder.deliveries.find(
        (delivery) => delivery.channel === channel,
      )?.status ?? 'PENDING'
    );
  }

  if (loading) {
    return (
      <main style={{ padding: '24px', fontFamily: 'sans-serif' }}>
        Loading reminders...
      </main>
    );
  }

  return (
    <main
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '24px',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '6px' }}>
            Upcoming Reminders
          </h1>

          <div style={{ color: '#666' }}>
            {reminders.length} upcoming reminder
            {reminders.length === 1 ? '' : 's'}
          </div>
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadReminders()}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p role="alert" style={{ fontWeight: 600 }}>
          {error}
        </p>
      )}

      {reminders.length === 0 ? (
        <p>No upcoming reminders.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '12px',
          }}
        >
          {reminders.map((reminder) => {
            const personName =
              `${reminder.event.person.firstName} ${
                reminder.event.person.lastName ?? ''
              }`.trim();

            return (
              <section
                key={reminder.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  padding: '16px',
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '20px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <strong>{reminder.event.title}</strong>

                    <div style={{ marginTop: '4px' }}>
                      Person: {personName}
                    </div>

                    <div>
                      Type: {reminder.event.type}
                    </div>

                    <div>
                      Due:{' '}
                      {new Date(
                        reminder.dueAt,
                      ).toLocaleString()}
                    </div>

                    {reminder.event.eventAt && (
                      <div>
                        Event:{' '}
                        {new Date(
                          reminder.event.eventAt,
                        ).toLocaleString()}
                      </div>
                    )}

                    {reminder.event.note && (
                      <div>
                        Note: {reminder.event.note}
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      minWidth: '170px',
                    }}
                  >
                    <div>
                      Telegram:{' '}
                      {status(reminder, 'TELEGRAM')}
                    </div>

                    <div>
                      Email: {status(reminder, 'EMAIL')}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
