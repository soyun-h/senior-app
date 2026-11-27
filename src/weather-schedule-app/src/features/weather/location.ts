import * as Location from 'expo-location';
import { resolveLocation } from '../../../shared/location.ts';
export async function locateWeather() {
  return resolveLocation({
    permission: async () => (await Location.requestForegroundPermissionsAsync()).status === 'granted',
    position: async () => {
      let timer: ReturnType<typeof setTimeout>;
      const point = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('LOCATION_TIMEOUT')), 10_000); }),
      ]).finally(() => clearTimeout(timer));
      return point.coords;
    },
  });
}
