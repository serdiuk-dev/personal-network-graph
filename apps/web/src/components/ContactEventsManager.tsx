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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [deletingReminderId, setDeletingReminderId] = useState<string | null>(
    null,
  );

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editType, setEditType] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editEventAt, setEditEventAt] = useState('');
  const [editNote, setEditNote] = useState('');
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

  const [editingReminderId, setEditingReminderId] = useState<string | null>(
    null,
  );
  const [editDueAt, setEditDueAt] = useState('');
  const [updatingReminderId, setUpdatingReminderId] = useState<string | null>(
    null,
  );

  const [error, setError] = useState<string | null>(null);

  async function loadData(showLoading = false) {
    if (showLoading) {
      setLoading(true);
    }

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
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadData(true);
  }, [personId]);

  async function createEvent(event: FormEvent) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

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
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    if (
      deletingEventId ||
      !window.confirm('Delete event and all reminders?')
    ) {
      return;
    }

    setDeletingEventId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/contact-events/${id}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        throw new Error(`Delete event failed: HTTP ${response.status}`);
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to delete event',
      );
    } finally {
      setDeletingEventId(null);
    }
  }

  async function deleteReminder(id: string) {
    if (
      deletingReminderId ||
      !window.confirm('Delete reminder?')
    ) {
      return;
    }

    setDeletingReminderId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/reminders/${id}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        throw new Error(
          `Delete reminder failed: HTTP ${response.status}`,
        );
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to delete reminder',
      );
    } finally {
      setDeletingReminderId(null);
    }
  }

  function toLocalDateTimeInput(value: string | null) {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - offset)
      .toISOString()
      .slice(0, 16);
  }

  function beginEditEvent(item: ContactEvent) {
    setEditingEventId(item.id);
    setEditType(item.type);
    setEditTitle(item.title);
    setEditEventAt(toLocalDateTimeInput(item.eventAt));
    setEditNote(item.note ?? '');
    setError(null);
  }

  function cancelEditEvent() {
    setEditingEventId(null);
    setEditType('');
    setEditTitle('');
    setEditEventAt('');
    setEditNote('');
  }

  async function updateEvent(id: string) {
    if (updatingEventId) {
      return;
    }

    setUpdatingEventId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/contact-events/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: editType.trim(),
            title: editTitle.trim(),
            eventAt: editEventAt
              ? new Date(editEventAt).toISOString()
              : null,
            note: editNote.trim() || null,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Update event failed: HTTP ${response.status}`,
        );
      }

      cancelEditEvent();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to update event',
      );
    } finally {
      setUpdatingEventId(null);
    }
  }

  function beginEditReminder(reminder: Reminder) {
    setEditingReminderId(reminder.id);
    setEditDueAt(toLocalDateTimeInput(reminder.dueAt));
    setError(null);
  }

  function cancelEditReminder() {
    setEditingReminderId(null);
    setEditDueAt('');
  }

  async function updateReminder(id: string) {
    if (updatingReminderId) {
      return;
    }

    setUpdatingReminderId(id);
    setError(null);

    try {
      const response = await fetch(
        `/api/v1/reminders/${id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dueAt: new Date(editDueAt).toISOString(),
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Reschedule failed: HTTP ${response.status}`,
        );
      }

      cancelEditReminder();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to reschedule reminder',
      );
    } finally {
      setUpdatingReminderId(null);
    }
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
    <section
      style={{
        marginTop: '24px',
        padding: '20px',
        border: '1px solid #bbb',
      }}
    >
      <h2>
        Events / Reminders
        {person
          ? ` — ${person.firstName} ${person.lastName ?? ''}`.trimEnd()
          : ''}
      </h2>

      <button type="button" onClick={onClose}>
        Close
      </button>

      {error && (
        <p role="alert" style={{ fontWeight: 600 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading events and reminders...</p>
      ) : (
        <>
          <form
            onSubmit={createEvent}
            style={{
              display: 'grid',
              gap: '10px',
              marginTop: '16px',
            }}
          >
            <input
              required
              disabled={saving}
              placeholder="Event type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />

            <input
              required
              disabled={saving}
              placeholder="Event title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <label>
              Event date/time
              <input
                type="datetime-local"
                disabled={saving}
                value={eventAt}
                onChange={(e) => setEventAt(e.target.value)}
              />
            </label>

            <label>
              Reminder due
              <input
                required
                type="datetime-local"
                disabled={saving}
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            </label>

            <textarea
              disabled={saving}
              placeholder="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <button type="submit" disabled={saving}>
              {saving ? 'Creating...' : 'Create event'}
            </button>
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
                  {editingEventId === item.id ? (
                    <div
                      style={{
                        display: 'grid',
                        gap: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      <input
                        required
                        value={editType}
                        disabled={updatingEventId === item.id}
                        onChange={(e) => setEditType(e.target.value)}
                      />

                      <input
                        required
                        value={editTitle}
                        disabled={updatingEventId === item.id}
                        onChange={(e) => setEditTitle(e.target.value)}
                      />

                      <label>
                        Event date/time
                        <input
                          type="datetime-local"
                          value={editEventAt}
                          disabled={updatingEventId === item.id}
                          onChange={(e) => setEditEventAt(e.target.value)}
                        />
                      </label>

                      <textarea
                        value={editNote}
                        disabled={updatingEventId === item.id}
                        onChange={(e) => setEditNote(e.target.value)}
                      />

                      <div>
                        <button
                          type="button"
                          disabled={
                            updatingEventId === item.id ||
                            !editType.trim() ||
                            !editTitle.trim()
                          }
                          onClick={() => updateEvent(item.id)}
                        >
                          {updatingEventId === item.id
                            ? 'Saving...'
                            : 'Save event'}
                        </button>{' '}

                        <button
                          type="button"
                          disabled={updatingEventId === item.id}
                          onClick={cancelEditEvent}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                        onClick={() => beginEditEvent(item)}
                      >
                        Edit event
                      </button>{' '}

                      <button
                        type="button"
                        disabled={deletingEventId === item.id}
                        onClick={() => deleteEvent(item.id)}
                      >
                        {deletingEventId === item.id
                          ? 'Deleting event...'
                          : 'Delete event'}
                      </button>
                    </>
                  )}

                  {item.reminders.map((reminder) => {
                    const canReschedule =
                      !reminder.completedAt &&
                      reminder.deliveries.length === 0;

                    return (
                      <div
                        key={reminder.id}
                        style={{
                          marginTop: '10px',
                          paddingTop: '10px',
                          borderTop: '1px solid #eee',
                        }}
                      >
                        {editingReminderId === reminder.id ? (
                          <div
                            style={{
                              display: 'grid',
                              gap: '8px',
                            }}
                          >
                            <label>
                              Reminder due
                              <input
                                required
                                type="datetime-local"
                                value={editDueAt}
                                disabled={
                                  updatingReminderId === reminder.id
                                }
                                onChange={(e) =>
                                  setEditDueAt(e.target.value)
                                }
                              />
                            </label>

                            <div>
                              <button
                                type="button"
                                disabled={
                                  updatingReminderId === reminder.id ||
                                  !editDueAt
                                }
                                onClick={() =>
                                  updateReminder(reminder.id)
                                }
                              >
                                {updatingReminderId === reminder.id
                                  ? 'Saving...'
                                  : 'Save reminder'}
                              </button>{' '}

                              <button
                                type="button"
                                disabled={
                                  updatingReminderId === reminder.id
                                }
                                onClick={cancelEditReminder}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div>
                              Reminder:{' '}
                              {new Date(
                                reminder.dueAt,
                              ).toLocaleString()}
                            </div>

                            <div>
                              State:{' '}
                              {reminder.completedAt
                                ? `Completed ${new Date(
                                    reminder.completedAt,
                                  ).toLocaleString()}`
                                : 'Active'}
                            </div>

                            <div>
                              Telegram:{' '}
                              {status(reminder, 'TELEGRAM')}
                            </div>

                            <div>
                              Email: {status(reminder, 'EMAIL')}
                            </div>

                            <button
                              type="button"
                              disabled={!canReschedule}
                              title={
                                canReschedule
                                  ? 'Change reminder time'
                                  : 'Delivery already started or completed'
                              }
                              onClick={() =>
                                beginEditReminder(reminder)
                              }
                            >
                              Reschedule
                            </button>{' '}

                            <button
                              type="button"
                              disabled={
                                deletingReminderId === reminder.id
                              }
                              onClick={() =>
                                deleteReminder(reminder.id)
                              }
                            >
                              {deletingReminderId === reminder.id
                                ? 'Deleting reminder...'
                                : 'Delete reminder'}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
