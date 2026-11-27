export function selectWeatherMode(development: boolean, requested?: string): 'demo' | 'live' {
  return development && requested === 'demo' ? 'demo' : 'live';
}
