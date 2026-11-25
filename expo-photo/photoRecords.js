import { Directory, File, Paths } from 'expo-file-system';

export function savePhotoRecord(uri, capturedAt, mission) {
  const pad = (value) => String(value).padStart(2, '0');
  const date = [capturedAt.getFullYear(), pad(capturedAt.getMonth() + 1), pad(capturedAt.getDate())].join('-');
  const directory = new Directory(Paths.document, 'oneureun-photo-records', date);
  directory.create({ idempotent: true, intermediates: true });
  const id = capturedAt.getTime() + '-' + Math.random().toString(36).slice(2);
  const pending = new File(directory, id + '.pending');
  const photo = new File(directory, id + '.jpg');
  const metadata = new File(directory, id + '.json');
  try {
    new File(uri).copy(pending);
    metadata.create();
    metadata.write(JSON.stringify({ capturedAt: capturedAt.toISOString(), mission }));
    pending.move(photo);
    return photo.uri;
  } catch (error) {
    for (const file of [pending, metadata, photo]) {
      try { if (file.exists) file.delete(); } catch {}
    }
    throw error;
  }
}
