// Local PNGs shared by the picker and the photo upload.
export const CONTACT_ICONS = [
  { id: 'art', label: 'Creativity', url: new URL('./contact-icons/art.png', import.meta.url).href },
  { id: 'it', label: 'IT', url: new URL('./contact-icons/it.png', import.meta.url).href },
  { id: 'sport', label: 'Sport', url: new URL('./contact-icons/sport.png', import.meta.url).href },
  { id: 'jewelry', label: 'Jewelry', url: new URL('./contact-icons/jewelry.png', import.meta.url).href },
  { id: 'money', label: 'Money', url: new URL('./contact-icons/money.png', import.meta.url).href },
  { id: 'doctor', label: 'Doctor', url: new URL('./contact-icons/doctor.png', import.meta.url).href },
  { id: 'law', label: 'Lawyer', url: new URL('./contact-icons/law.png', import.meta.url).href },
  { id: 'leisure', label: 'Leisure', url: new URL('./contact-icons/leisure.png', import.meta.url).href },
] as const;

export async function createContactIconFile(id: string): Promise<File> {
  const icon = CONTACT_ICONS.find(item => item.id === id);
  if (!icon) throw new Error('Unknown icon.');
  const image = new Image();
  image.src = icon.url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare icon.');
  context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value =>
    value ? resolve(value) : reject(new Error('Unable to prepare icon.')), 'image/png'));
  return new File([blob], 'icon-' + icon.id + '.png', { type: 'image/png' });
}
