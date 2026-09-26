import { FormEvent, useEffect, useState } from 'react';

type ReminderDelivery = {
  channel: 'TELEGRAM' | 'EMAIL';
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
};

type Reminder = {
  id: string;
  dueAt: string;
  completedAt: string | null;
  deliveries: ReminderDelivery[];
};

type ContactEvent = {
  id: string;
  type: string;
  title: string;
  eventAt: string | null;
  note: string | null;
  reminders: Reminder[];
};

type PersonSummary = {
  firstName: string;
  lastName: string | null;
};

type Props = {
  personId: string;
  onClose: () => void;
};

export function ContactEventsManager({
  personId,
  onClose,
}: Props) {
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [eventAt, setEventAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [personResponse, eventsResponse] = await Promise.all([
        fetch(`/api/v1/people/${personId}`),
        fetch(`/api/v1/people/${personId}/contact-events`),
      ]);

      if (!personResponse.ok || !eventsResponse.ok) {
        throw new Error('Unable to load contact events');
      }

      setPerson(await personResponse.json());
      setEvents(await eventsResponse.json());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load data',
      );
    }
  }

  useEffect(() => {
    loadData();
  }, [personId]);

  async function createEvent(event: FormEvent) {
    event.preventDefault();

    try {
      const response = await fetch(
        `/api/v1/people/${personId}/contact-events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: type.trim(),
            title: title.trim(),
            ...(eventAt
              ? { eventAt: new Date(eventAt).toISOString() }
              : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
            dueAt: new Date(dueAt).toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Create failed: HTTP ${response.status}`);
      }

      setType('');
      setTitle('');
      setEventAt('');
      setDueAt('');
      setNote('');

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create event',
      );
    }
  }

  async function deleteEvent(id: string) {
    if (!window.confirm('Delete event and all reminders?')) {
      return;
    }

    const response = await fetch(
      `/api/v1/contact-events/${id}`,
      { method: 'DELETE' },
    );

    if (!response.ok) {
      setError(`Delete event failed: HTTP ${response.status}`);
      return;
    }

    await loadData();
  }

  async function deleteReminder(id: string) {
    if (!window.confirm('Delete reminder?')) {
      return;
    }

    const response = await fetch(
      `/api/v1/reminders/${id}`,
      { method: 'DELETE' },
    );

    if (!response.ok) {
      setError(`Delete reminder failed: HTTP ${response.status}`);
      return;
    }

    await loadData();
  }

  function status(
    reminder: Reminder,
    channel: 'TELEGRAM' | 'EMAIL',
  ) {
    return (
      reminder.deliveries.find(
        (delivery) => delivery.channel === channel,
      )?.status ?? 'PENDING'
    );
  }

  const upcomingReminders = events
    .flatMap((item) =>
      item.reminders.map((reminder) => ({
        reminder,
        eventTitle: item.title,
      })),
    )
    .filter(
      ({ reminder }) =>
        !reminder.completedAt &&
        new Date(reminder.dueAt).getTime() > Date.now(),
    )
    .sort(
      (a, b) =>
        new Date(a.reminder.dueAt).getTime() -
        new Date(b.reminder.dueAt).getTime(),
    );

  return (
    <section style={{ marginTop: '24px', padding: '20px', border: '1px solid #bbb' }}>
      <h2>
        Events / Reminders
        {person
          ? ` — ${person.firstName} ${person.lastName ?? ''}`.trimEnd()
          : ''}
      </h2>

      <button type="button" onClick={onClose}>
        Close
      </button>

      {error && <p>{error}</p>}

      <form
        onSubmit={createEvent}
        style={{ display: 'grid', gap: '10px', marginTop: '16px' }}
      >
        <input
          required
          placeholder="Event type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        />

        <input
          required
          placeholder="Event title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <label>
          Event date/time
          <input
            type="datetime-local"
            value={eventAt}
            onChange={(e) => setEventAt(e.target.value)}
          />
        </label>

        <label>
          Reminder due
          <input
            required
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </label>

        <textarea
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button type="submit">Create event</button>
      </form>

      <div style={{ marginTop: '20px' }}>
        <h3>Upcoming reminders</h3>

        {upcomingReminders.length === 0 ? (
          <p>No upcoming reminders.</p>
        ) : (
          upcomingReminders.map(({ reminder, eventTitle }) => (
            <div
              key={reminder.id}
              style={{
                border: '1px solid #ddd',
                padding: '10px',
                marginBottom: '8px',
              }}
            >
              <strong>{eventTitle}</strong>

              <div>
                Due: {new Date(reminder.dueAt).toLocaleString()}
              </div>

              <div>
                Telegram: {status(reminder, 'TELEGRAM')}
              </div>

              <div>
                Email: {status(reminder, 'EMAIL')}
              </div>
            </div>
          ))
        )}

        <h3 style={{ marginTop: '24px' }}>
          Contact events
        </h3>

        {events.length === 0 ? (
          <p>No contact events yet.</p>
        ) : (
          events.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #ddd',
                padding: '12px',
                marginBottom: '12px',
              }}
            >
              <strong>{item.title}</strong>
              <div>Type: {item.type}</div>
              <div>
                Event:{' '}
                {item.eventAt
                  ? new Date(item.eventAt).toLocaleString()
                  : '—'}
              </div>

              {item.note && <div>Note: {item.note}</div>}

              <button
                type="button"
                onClick={() => deleteEvent(item.id)}
              >
                Delete event
              </button>

              {item.reminders.map((reminder) => (
                <div
                  key={reminder.id}
                  style={{ marginTop: '10px' }}
                >
                  <div>
                    Reminder:{' '}
                    {new Date(reminder.dueAt).toLocaleString()}
                  </div>
                  <div>
                    Telegram: {status(reminder, 'TELEGRAM')}
                  </div>
                  <div>
                    Email: {status(reminder, 'EMAIL')}
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteReminder(reminder.id)}
                  >
                    Delete reminder
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
