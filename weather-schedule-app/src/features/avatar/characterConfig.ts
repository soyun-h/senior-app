import raw from './characters.json';
import { findCharacter } from './characterBrain';
import type { CharacterConfig, CharacterId } from './characterTypes';

const config = raw as CharacterConfig;

export function getCharacter(id: CharacterId = 'char1') {
  return findCharacter(config, id);
}
