import { dayKey } from './calendarDates.mjs';

function openRecords() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('oneureun-calendar', 1);
    request.onupgradeneeded = () => {
      const photos = request.result.createObjectStore('photos', { keyPath: 'id' });
      photos.createIndex('day', 'day');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listPhotoRecords(key) {
  const database = await openRecords();
  try {
    const photos = await new Promise((resolve, reject) => {
      const request = database.transaction('photos').objectStore('photos').index('day').getAll(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return photos.sort((first, second) => first.id.localeCompare(second.id)).map(({ id, blob }) => {
      const uri = URL.createObjectURL(blob);
      return { id, source: { uri }, release: () => URL.revokeObjectURL(uri) };
    });
  } finally {
    database.close();
  }
}

export async function savePhotoRecord({ uri, file, capturedAt = new Date() }) {
  const blob = file ?? await (await fetch(uri)).blob();
  const database = await openRecords();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('photos', 'readwrite');
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore('photos').add({
        id: `${capturedAt.getTime()}-${Math.random().toString(36).slice(2)}`,
        day: dayKey(capturedAt),
        blob,
      });
    });
  } finally {
    database.close();
  }
}
