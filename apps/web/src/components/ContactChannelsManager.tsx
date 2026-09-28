import { focusFirstField } from './FocusPanel';
import { FormEvent, useEffect, useRef, useState } from 'react';

type ContactPlatform =
  | 'TELEGRAM'
  | 'LINKEDIN'
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'MESSENGER'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'SIGNAL'
  | 'VIBER'
  | 'PHONE'
  | 'OTHER';

type ContactChannel = {
  id: string;
  personId: string;
  platform: ContactPlatform;
  handle: string | null;
  address: string | null;
  externalId: string | null;
  profileUrl: string | null;
  isPreferred: boolean;
  priority: number;
  isActive: boolean;
  automationAllowed: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PersonSummary = {
  id: string;
  firstName: string;
  lastName: string | null;
};

type ChannelForm = {
  platform: ContactPlatform;
  handle: string;
  address: string;
  externalId: string;
  profileUrl: string;
  isPreferred: boolean;
  priority: number;
  isActive: boolean;
  automationAllowed: boolean;
  notes: string;
};

const platforms: ContactPlatform[] = [
  'TELEGRAM',
  'EMAIL',
  'LINKEDIN',
  'INSTAGRAM',
  'FACEBOOK',
  'MESSENGER',
  'WHATSAPP',
  'SIGNAL',
  'VIBER',
  'PHONE',
  'OTHER',
];

const emptyForm: ChannelForm = {
  platform: 'TELEGRAM',
  handle: '',
  address: '',
  externalId: '',
  profileUrl: '',
  isPreferred: false,
  priority: 100,
  isActive: true,
  automationAllowed: false,
  notes: '',
};

type Props = {
  personId: string;
  onClose: () => void;
};

export function ContactChannelsManager({
  personId,
  onClose,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [person, setPerson] = useState<PersonSummary | null>(null);
  const [channels, setChannels] = useState<ContactChannel[]>([]);
  const [form, setForm] = useState<ChannelForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);

      const [personResponse, channelsResponse] = await Promise.all([
        fetch(`/api/v1/people/${personId}`),
        fetch(`/api/v1/people/${personId}/contact-channels`),
      ]);

      if (!personResponse.ok) {
        throw new Error(
          `Person API returned HTTP ${personResponse.status}`,
        );
      }

      if (!channelsResponse.ok) {
        throw new Error(
          `Contact Channels API returned HTTP ${channelsResponse.status}`,
        );
      }

      setPerson(await personResponse.json());
      setChannels(await channelsResponse.json());
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load contact channels',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    resetForm();
    loadData();
  }, [personId]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function startEdit(channel: ContactChannel) {
    setEditingId(channel.id);

    setForm({
      platform: channel.platform,
      handle: channel.handle ?? '',
      address: channel.address ?? '',
      externalId: channel.externalId ?? '',
      profileUrl: channel.profileUrl ?? '',
      isPreferred: channel.isPreferred,
      priority: channel.priority,
      isActive: channel.isActive,
      automationAllowed: channel.automationAllowed,
      notes: channel.notes ?? '',
    });
    focusFirstField(formRef.current);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const payload = {
      platform: form.platform,

      ...(form.handle.trim()
        ? { handle: form.handle.trim() }
        : {}),

      ...(form.address.trim()
        ? { address: form.address.trim() }
        : {}),

      ...(form.externalId.trim()
        ? { externalId: form.externalId.trim() }
        : {}),

      ...(form.profileUrl.trim()
        ? { profileUrl: form.profileUrl.trim() }
        : {}),

      isPreferred: form.isPreferred,
      priority: form.priority,
      isActive: form.isActive,
      automationAllowed: form.automationAllowed,

      ...(form.notes.trim()
        ? { notes: form.notes.trim() }
        : {}),
    };

    try {
      const response = await fetch(
        editingId
          ? `/api/v1/contact-channels/${editingId}`
          : `/api/v1/people/${personId}/contact-channels`,
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          `HTTP ${response.status}: ${body}`,
        );
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save contact channel',
      );
    }
  }

  async function removeChannel(channel: ContactChannel) {
    const confirmed = window.confirm(
      `Delete ${channel.platform} contact channel?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/contact-channels/${channel.id}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        const body = await response.text();

        throw new Error(
          `HTTP ${response.status}: ${body}`,
        );
      }

      if (editingId === channel.id) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete contact channel',
      );
    }
  }

  return (
    <section
      style={{
        marginTop: '24px',
        padding: '20px',
        border: '1px solid #bbb',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          display: 'flex', flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <h2>
          Contact Channels
          {person
            ? ` — ${person.firstName} ${person.lastName ?? ''}`.trimEnd()
            : ''}
        </h2>

        <button
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {error && (
        <div className="pnet-error" role="alert"
          style={{
            marginBottom: '16px',
            padding: '10px',
            border: '1px solid #c00',
          }}
        >
          {error}
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
          gap: '12px',
          padding: '16px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <label>
          Platform

          <select
            value={form.platform}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                platform:
                  event.target.value as ContactPlatform,
              }))
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          >
            {platforms.map((platform) => (
              <option
                key={platform}
                value={platform}
              >
                {platform}
              </option>
            ))}
          </select>
        </label>

        <label className="pnet-field">
          <span>Handle / username</span>
          <input
            placeholder="Handle / username"
            value={form.handle}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                handle: event.target.value,
              }))
            }
          />
        </label>

        <label className="pnet-field">
          <span>Address / email / phone</span>
          <input
            placeholder="Address / email / phone"
            value={form.address}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
          />
        </label>

        <label className="pnet-field">
          <span>Profile URL</span>
          <input
            placeholder="Profile URL"
            value={form.profileUrl}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                profileUrl: event.target.value,
              }))
            }
          />
        </label>

        <label className="pnet-field">
          <span>External ID</span>
          <input
            placeholder="External ID"
            value={form.externalId}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                externalId: event.target.value,
              }))
            }
          />
        </label>

        <label>
          Priority

          <input
            type="number"
            min="1"
            step="1"
            value={form.priority}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                priority: Number(event.target.value),
              }))
            }
            style={{
              display: 'block',
              width: '100%',
            }}
          />
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.isPreferred}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isPreferred: event.target.checked,
              }))
            }
          />{' '}
          Preferred
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                isActive: event.target.checked,
              }))
            }
          />{' '}
          Active
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.automationAllowed}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                automationAllowed: event.target.checked,
              }))
            }
          />{' '}
          Automation allowed
        </label>

        <label className="pnet-field pnet-field-full">
          <span>Notes</span>
          <textarea
            placeholder="Notes"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                notes: event.target.value,
              }))
            }
            style={{
              minHeight: '70px',
            }}
          />
        </label>

        <div
          style={{
            display: 'flex', flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <button type="submit">
            {editingId
              ? 'Save channel'
              : 'Add channel'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="pnet-state" role="status">Loading...</p>
      ) : channels.length === 0 ? (
        <p className="pnet-state">No contact channels yet.</p>
      ) : (
        <div tabIndex={0} role="region" aria-label="Contact channels table" style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr>
                <th align="left">Platform</th>
                <th align="left">Contact</th>
                <th align="left">Routing</th>
                <th align="left">Status</th>
                <th align="left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {channels.map((channel) => (
                <tr
                  key={channel.id}
                  style={{
                    borderTop: '1px solid #ddd',
                  }}
                >
                  <td style={{ padding: '12px 4px' }}>
                    {channel.platform}
                  </td>

                  <td>
                    {channel.handle ??
                      channel.address ??
                      channel.profileUrl ??
                      '—'}
                  </td>

                  <td>
                    Priority {channel.priority}
                    <br />
                    {channel.automationAllowed
                      ? 'Auto send allowed'
                      : 'Manual only'}
                    {channel.externalId && (
                      <>
                        <br />
                        ID: {channel.externalId}
                      </>
                    )}
                  </td>

                  <td>
                    {channel.isPreferred
                      ? 'Preferred'
                      : 'Standard'}
                    {' · '}
                    {channel.isActive
                      ? 'Active'
                      : 'Inactive'}
                  </td>

                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        startEdit(channel)
                      }
                    >
                      Edit
                    </button>

                    {' '}

                    <button
                      type="button"
                      onClick={() =>
                        removeChannel(channel)
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
