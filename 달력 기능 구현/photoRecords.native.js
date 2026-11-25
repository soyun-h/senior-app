import { Directory, File, Paths } from 'expo-file-system';
import { dayKey } from './calendarDates.mjs';

function directoryForDay(key) {
  return new Directory(Paths.document, 'oneureun-photo-records', key);
}

export async function listPhotoRecords(key) {
  const photos = directoryForDay(key);
  if (!photos.exists) return [];

  return photos.list()
    .filter((entry) => entry instanceof File && /\.(jpg|png|webp|heic|heif|avif)$/i.test(entry.name))
    .sort((first, second) => first.name.localeCompare(second.name))
    .map((file) => ({ id: file.name, source: { uri: file.uri } }));
}

export async function savePhotoRecord({ uri, capturedAt = new Date() }) {
  const photos = directoryForDay(dayKey(capturedAt));
  photos.create({ idempotent: true, intermediates: true });
  const source = new File(uri);
  const extension = source.extension.toLowerCase();
  const suffix = /^(\.png|\.webp|\.heic|\.heif|\.avif)$/.test(extension) ? extension : '.jpg';
  const id = `${capturedAt.getTime()}-${Math.random().toString(36).slice(2)}${suffix}`;
  const incoming = new File(photos, `${id}.pending`);

  try {
    source.copy(incoming);
    incoming.move(new File(photos, id));
  } catch (error) {
    if (incoming.exists) incoming.delete();
    throw error;
  }
}
