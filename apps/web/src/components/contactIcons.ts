// Bundled geometric icons. Only these trusted paths can be rasterized.
export const CONTACT_ICONS = [
  { id: 'person', label: 'Person', path: 'M12 5a4 4 0 1 0 0 8a4 4 0 1 0 0-8M5 20v-2c0-5 14-5 14 0v2Z' },
  { id: 'heart', label: 'Heart', path: 'M12 20L4.5 12.5C-1 6 7 1 12 7C17 1 25 6 19.5 12.5Z' },
  { id: 'star', label: 'Star', path: 'M12 3L15 9L22 10L17 15L18 22L12 18.5L6 22L7 15L2 10L9 9Z' },
  { id: 'home', label: 'Home', path: 'M3 11L12 3L21 11H19V21H14V14H10V21H5V11Z' },
  { id: 'work', label: 'Work', path: 'M8 4H16V8H21V20H3V8H8ZM10 6V8H14V6Z' },
  { id: 'book', label: 'Book', path: 'M3 4C6 3 9 4 11 6V21C9 19 6 18 3 19ZM13 6C15 4 18 3 21 4V19C18 18 15 19 13 21Z' },
] as const;

export async function createContactIconFile(id: string): Promise<File> {
  const icon = CONTACT_ICONS.find(item => item.id === id);
  if (!icon) throw new Error('Unknown icon.');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare icon. Try uploading an image.');
  context.scale(256 / 24, 256 / 24);
  context.fillStyle = '#eff6ff';
  context.fillRect(0, 0, 24, 24);
  context.fillStyle = '#2563eb';
  context.fill(new Path2D(icon.path), 'evenodd');
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to prepare icon.')), 'image/png');
  });
  return new File([blob], `icon-${icon.id}.png`, { type: 'image/png' });
}
