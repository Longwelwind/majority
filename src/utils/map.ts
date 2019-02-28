export function get<K, V>(map: Map<K, V>, key: K): V {
	if (!map.has(key)) {
		throw new Error("key " + key + " not in map");
	}

	return map.get(key) as V;
}

export function map_to_array<K, V>(map: Map<K, V>): [K, V][] {
	return Array.from(map.entries())
}