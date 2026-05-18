export interface RiverCorridor {
  upstream_to_downstream: string[];
  lag_hours: Record<string, number>;
}

export interface RiverTopology {
  [corridor: string]: RiverCorridor;
}

export const RIVER_TOPOLOGY: RiverTopology = {
  jamuna_corridor: {
    upstream_to_downstream: ["SW257.4", "SW46.9L", "SW149.5"],
    lag_hours: {
      "SW257.4→SW46.9L": 8,
      "SW46.9L→SW149.5": 12,
    },
  },
  surma_corridor: {
    upstream_to_downstream: ["NE95.4", "NE75.4", "NE30.5"],
    lag_hours: {
      "NE95.4→NE75.4": 6,
      "NE75.4→NE30.5": 14,
    },
  },
  padma_corridor: {
    upstream_to_downstream: ["SW90.9L", "SW91.5L", "SW75.5L"],
    lag_hours: {
      "SW90.9L→SW91.5L": 10,
      "SW91.5L→SW75.5L": 8,
    },
  },
};

export const UPAZILA_TO_STATIONS: Record<string, string[]> = {
  "Sylhet Sadar":      ["NE95.4"],
  "Sunamganj Sadar":   ["NE75.4"],
  "Bhairab":           ["NE30.5"],
  "Islampur":          ["SW257.4"],
  "Sirajganj Sadar":   ["SW46.9L"],
  "Daulatpur":         ["SW149.5"],
  "Ishwardi":          ["SW90.9L"],
  "Goalundaghat":      ["SW91.5L"],
  "Louhajang":         ["SW75.5L"],
  "Chandpur Sadar":    ["NE25.5"],
};

// Returns station IDs that are upstream of the given station (same corridor)
export function getUpstreamStations(stationId: string): string[] {
  for (const corridor of Object.values(RIVER_TOPOLOGY)) {
    const idx = corridor.upstream_to_downstream.indexOf(stationId);
    if (idx > 0) {
      return corridor.upstream_to_downstream.slice(0, idx);
    }
  }
  return [];
}

// Returns the lag hours between two adjacent stations
export function getLagHours(fromStation: string, toStation: string): number | null {
  const key = `${fromStation}→${toStation}`;
  for (const corridor of Object.values(RIVER_TOPOLOGY)) {
    if (key in corridor.lag_hours) return corridor.lag_hours[key];
  }
  return null;
}

// Returns the corridor name for a given station
export function getCorridorForStation(stationId: string): string | null {
  for (const [name, corridor] of Object.entries(RIVER_TOPOLOGY)) {
    if (corridor.upstream_to_downstream.includes(stationId)) return name;
  }
  return null;
}
