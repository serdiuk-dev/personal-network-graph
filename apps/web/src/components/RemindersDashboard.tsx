import { useEffect, useState } from 'react';

type ReminderChannel = 'TELEGRAM' | 'EMAIL';
type ReminderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED';

type ReminderDelivery = {
  channel: ReminderChannel;
  status: ReminderStatus;
  attemptedAt: string | null;
  sentAt: string | null;
  providerMessageId: string | null;
  failureReason: string | null;
};

type ReminderItem = {
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

type ReminderView = 'upcoming' | 'history';
type ChannelFilter = 'ALL' | ReminderChannel;
type StatusFilter = 'ALL' | ReminderStatus;

type RemindersDashboardProps = {
  onOpenPerson: (personId: string) => void;
};

export function RemindersDashboard({
  onOpenPerson,
}: RemindersDashboardProps) {
  const [view, setView] =
    useState<ReminderView>('upcoming');
  const [reminders, setReminders] =
    useState<ReminderItem[]>([]);
  const [channelFilter, setChannelFilter] =
    useState<ChannelFilter>('ALL');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('ALL');
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingReminderId, setEditingReminderId] =
    useState<string | null>(null);
  const [editDueAt, setEditDueAt] = useState('');
  const [updatingReminderId, setUpdatingReminderId] =
    useState<string | null>(null);
  const [deletingReminderId, setDeletingReminderId] =
    useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] =
    useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadReminders(
    targetView: ReminderView,
    showLoading = false,
  ) {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setError(null);

    try {
      const endpoint =
        targetView === 'upcoming'
          ? '/api/v1/reminders/upcoming'
          : '/api/v1/reminders/history';

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(
          `Reminders API returned HTTP ${response.status}`,
        );
      }

      setReminders(await response.json());
      setLastUpdatedAt(new Date());
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
    void loadReminders(view, true);
  }, [view]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadReminders(view);
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [view]);

  function status(
    reminder: ReminderItem,
    channel: ReminderChannel,
  ): ReminderStatus {
    return (
      reminder.deliveries.find(
        (delivery) => delivery.channel === channel,
      )?.status ?? 'PENDING'
    );
  }

  function switchView(nextView: ReminderView) {
    if (nextView !== view) {
      setEditingReminderId(null);
      setEditDueAt('');
      setView(nextView);
    }
  }

  function toLocalDateTimeInput(value: string) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60_000;

    return new Date(date.getTime() - offset)
      .toISOString()
      .slice(0, 16);
  }

  function beginEditReminder(reminder: ReminderItem) {
    setEditingReminderId(reminder.id);
    setEditDueAt(toLocalDateTimeInput(reminder.dueAt));
    setError(null);
  }

  function cancelEditReminder() {
    setEditingReminderId(null);
    setEditDueAt('');
  }

  async function updateReminder(id: string) {
    if (updatingReminderId || !editDueAt) {
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
      await loadReminders(view);
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

      if (editingReminderId === id) {
        cancelEditReminder();
      }

      await loadReminders(view);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete reminder',
      );
    } finally {
      setDeletingReminderId(null);
    }
  }

  const normalizedSearch =
    searchText.trim().toLowerCase();

  const fromTime = dateFrom
    ? new Date(`${dateFrom}T00:00:00`).getTime()
    : null;

  const toTime = dateTo
    ? new Date(`${dateTo}T23:59:59.999`).getTime()
    : null;

  const scopedReminders = reminders.filter(
    (reminder) => {
      const personName =
        `${reminder.event.person.firstName} ${
          reminder.event.person.lastName ?? ''
        }`
          .trim()
          .toLowerCase();

      const eventTitle =
        reminder.event.title.toLowerCase();

      if (
        normalizedSearch &&
        !personName.includes(normalizedSearch) &&
        !eventTitle.includes(normalizedSearch)
      ) {
        return false;
      }

      const dueTime = new Date(
        reminder.dueAt,
      ).getTime();

      if (
        fromTime !== null &&
        dueTime < fromTime
      ) {
        return false;
      }

      if (
        toTime !== null &&
        dueTime > toTime
      ) {
        return false;
      }

      return true;
    },
  );

  const summaryChannels: ReminderChannel[] =
    channelFilter === 'ALL'
      ? ['TELEGRAM', 'EMAIL']
      : [channelFilter];

  const deliverySummary: Record<ReminderStatus, number> = {
    PENDING: 0,
    PROCESSING: 0,
    SENT: 0,
    FAILED: 0,
  };

  for (const reminder of scopedReminders) {
    for (const channel of summaryChannels) {
      deliverySummary[status(reminder, channel)] += 1;
    }
  }

  const summaryTotal =
    scopedReminders.length * summaryChannels.length;

  const filteredReminders = scopedReminders.filter(
    (reminder) => {
      if (statusFilter === 'ALL') {
        return true;
      }

      return summaryChannels.some(
        (channel) =>
          status(reminder, channel) === statusFilter,
      );
    },
  );

  const summaryItems: Array<{
    label: string;
    value: number;
    status: StatusFilter;
  }> = [
    {
      label: 'Total',
      value: summaryTotal,
      status: 'ALL',
    },
    {
      label: 'Pending',
      value: deliverySummary.PENDING,
      status: 'PENDING',
    },
    {
      label: 'Processing',
      value: deliverySummary.PROCESSING,
      status: 'PROCESSING',
    },
    {
      label: 'Sent',
      value: deliverySummary.SENT,
      status: 'SENT',
    },
    {
      label: 'Failed',
      value: deliverySummary.FAILED,
      status: 'FAILED',
    },
  ];

  if (loading) {
    return (
      <main className="pnet-page">
        Loading reminders...
      </main>
    );
  }

  const isUpcoming = view === 'upcoming';

  return (
    <main className="pnet-page">
      <div
        style={{
          display: 'flex', flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        <div>
          <h1 style={{ marginBottom: '6px' }}>
            Reminders
          </h1>

          <div style={{ color: '#666' }}>
            {isUpcoming
              ? 'Upcoming reminders across all people'
              : 'Completed reminder delivery history'}
          </div>

          {lastUpdatedAt && (
            <div
              style={{
                color: '#777',
                fontSize: '0.9em',
                marginTop: '4px',
              }}
            >
              Last updated:{' '}
              {lastUpdatedAt.toLocaleString()}
              {' · '}Auto-refresh every 60 seconds
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={refreshing}
          onClick={() => void loadReminders(view)}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <button
          type="button"
          disabled={view === 'upcoming'}
          onClick={() => switchView('upcoming')}
        >
          Upcoming
        </button>

        <button
          type="button"
          disabled={view === 'history'}
          onClick={() => switchView('history')}
        >
          History
        </button>
      </div>

      <div
        style={{
          marginBottom: '16px',
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            marginBottom: '10px',
            fontWeight: 600,
          }}
        >
          Delivery status summary
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {summaryItems.map((item) => {
            const active =
              statusFilter === item.status;

            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setStatusFilter(item.status)
                }
                style={{
                  minWidth: '100px',
                  padding: '8px 10px',
                  border: active
                    ? '2px solid #333'
                    : '1px solid #ddd',
                  borderRadius: '6px',
                  background: active
                    ? '#f2f2f2'
                    : '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#666' }}>
                  {item.label}
                </div>
                <strong>{item.value}</strong>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pnet-filters"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'end',
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <label>
          Search
          <input
            type="search"
            placeholder="Person or event title"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          />
        </label>

        <label>
          Due from
          <input
            type="date"
            value={dateFrom}
            onChange={(event) =>
              setDateFrom(event.target.value)
            }
            style={{ display: 'block' }}
          />
        </label>

        <label>
          Due to
          <input
            type="date"
            value={dateTo}
            onChange={(event) =>
              setDateTo(event.target.value)
            }
            style={{ display: 'block' }}
          />
        </label>

        <label>
          Channel
          <select
            value={channelFilter}
            onChange={(event) =>
              setChannelFilter(
                event.target.value as ChannelFilter,
              )
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          >
            <option value="ALL">All channels</option>
            <option value="TELEGRAM">Telegram</option>
            <option value="EMAIL">Email</option>
          </select>
        </label>

        <label>
          Status
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as StatusFilter,
              )
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PROCESSING">Processing</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>

        <button
          type="button"
          disabled={
            channelFilter === 'ALL' &&
            statusFilter === 'ALL' &&
            !searchText &&
            !dateFrom &&
            !dateTo
          }
          onClick={() => {
            setChannelFilter('ALL');
            setStatusFilter('ALL');
            setSearchText('');
            setDateFrom('');
            setDateTo('');
          }}
        >
          Clear filters
        </button>
      </div>

      {error && (
        <p className="pnet-error" role="alert" style={{ fontWeight: 600 }}>
          {error}
        </p>
      )}

      <div
        style={{
          color: '#666',
          marginBottom: '16px',
        }}
      >
        {filteredReminders.length} shown of{' '}
        {reminders.length}{' '}
        {isUpcoming ? 'upcoming' : 'completed'} reminder
        {reminders.length === 1 ? '' : 's'}
      </div>

      {filteredReminders.length === 0 ? (
        <p className="pnet-state">
          {reminders.length === 0
            ? isUpcoming
              ? 'No upcoming reminders.'
              : 'No reminder history yet.'
            : 'No reminders match the selected filters.'}
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: '12px',
          }}
        >
          {filteredReminders.map((reminder) => {
            const personName =
              `${reminder.event.person.firstName} ${
                reminder.event.person.lastName ?? ''
              }`.trim();

            const telegramDelivery =
              reminder.deliveries.find(
                (delivery) =>
                  delivery.channel === 'TELEGRAM',
              );

            const emailDelivery =
              reminder.deliveries.find(
                (delivery) =>
                  delivery.channel === 'EMAIL',
              );

            const canReschedule =
              isUpcoming &&
              !reminder.completedAt &&
              reminder.deliveries.length === 0;

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
                    display: 'flex', flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    gap: '20px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <strong>
                      {reminder.event.title}
                    </strong>

                    <div
                      style={{
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>Person: {personName}</span>

                      <button
                        type="button"
                        onClick={() =>
                          onOpenPerson(
                            reminder.event.person.id,
                          )
                        }
                      >
                        Open person
                      </button>
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

                    {reminder.completedAt && (
                      <div>
                        Completed:{' '}
                        {new Date(
                          reminder.completedAt,
                        ).toLocaleString()}
                      </div>
                    )}

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
                      width: 'min(100%, 320px)',
                      display: 'grid',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div>
                        <strong>Telegram:</strong>{' '}
                        {status(reminder, 'TELEGRAM')}
                      </div>

                      {telegramDelivery && (
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '0.9em',
                            color: '#555',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {telegramDelivery.attemptedAt && (
                            <div>
                              Attempted:{' '}
                              {new Date(
                                telegramDelivery.attemptedAt,
                              ).toLocaleString()}
                            </div>
                          )}

                          {telegramDelivery.sentAt && (
                            <div>
                              Sent:{' '}
                              {new Date(
                                telegramDelivery.sentAt,
                              ).toLocaleString()}
                            </div>
                          )}

                          {telegramDelivery.providerMessageId && (
                            <div>
                              Provider ID:{' '}
                              {telegramDelivery.providerMessageId}
                            </div>
                          )}

                          {telegramDelivery.failureReason && (
                            <div
                              role="alert"
                              style={{
                                marginTop: '6px',
                                padding: '6px 8px',
                                border: '1px solid #b42318',
                                borderRadius: '6px',
                                color: '#b42318',
                                fontWeight: 600,
                              }}
                            >
                              Failure:{' '}
                              {telegramDelivery.failureReason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div>
                        <strong>Email:</strong>{' '}
                        {status(reminder, 'EMAIL')}
                      </div>

                      {emailDelivery && (
                        <div
                          style={{
                            marginTop: '4px',
                            fontSize: '0.9em',
                            color: '#555',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {emailDelivery.attemptedAt && (
                            <div>
                              Attempted:{' '}
                              {new Date(
                                emailDelivery.attemptedAt,
                              ).toLocaleString()}
                            </div>
                          )}

                          {emailDelivery.sentAt && (
                            <div>
                              Sent:{' '}
                              {new Date(
                                emailDelivery.sentAt,
                              ).toLocaleString()}
                            </div>
                          )}

                          {emailDelivery.providerMessageId && (
                            <div>
                              Provider ID:{' '}
                              {emailDelivery.providerMessageId}
                            </div>
                          )}

                          {emailDelivery.failureReason && (
                            <div
                              role="alert"
                              style={{
                                marginTop: '6px',
                                padding: '6px 8px',
                                border: '1px solid #b42318',
                                borderRadius: '6px',
                                color: '#b42318',
                                fontWeight: 600,
                              }}
                            >
                              Failure:{' '}
                              {emailDelivery.failureReason}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {isUpcoming && (
                      <div style={{ marginTop: '12px' }}>
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
                                  updatingReminderId ===
                                  reminder.id
                                }
                                onChange={(event) =>
                                  setEditDueAt(
                                    event.target.value,
                                  )
                                }
                              />
                            </label>

                            <div>
                              <button
                                type="button"
                                disabled={
                                  updatingReminderId ===
                                    reminder.id ||
                                  !editDueAt
                                }
                                onClick={() =>
                                  void updateReminder(
                                    reminder.id,
                                  )
                                }
                              >
                                {updatingReminderId ===
                                reminder.id
                                  ? 'Saving...'
                                  : 'Save reminder'}
                              </button>{' '}

                              <button
                                type="button"
                                disabled={
                                  updatingReminderId ===
                                  reminder.id
                                }
                                onClick={cancelEditReminder}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={!canReschedule}
                              title={
                                canReschedule
                                  ? 'Change reminder time'
                                  : 'Delivery already started'
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
                                deletingReminderId ===
                                reminder.id
                              }
                              onClick={() =>
                                void deleteReminder(
                                  reminder.id,
                                )
                              }
                            >
                              {deletingReminderId ===
                              reminder.id
                                ? 'Deleting reminder...'
                                : 'Delete reminder'}
                            </button>
                          </>
                        )}
                      </div>
                    )}
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
