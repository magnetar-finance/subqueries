const ephemeralHashmap = new Map<string, string>();

export function updateEphemeralHashmap(id: string, value: string) {
  ephemeralHashmap.set(id, value);
  return value;
}

export function getValueFromEphemeralHashMap(id: string) {
  return ephemeralHashmap.get(id) || '';
}
