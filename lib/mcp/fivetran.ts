// Fivetran MCP (Model Context Protocol) integration
// Exposes Fivetran data pipeline management as MCP tools for the Gemini agent

export interface FivetranConnector {
  id: string;
  service: string;
  schema: string;
  status: {
    sync_state: string;
    is_historical_sync: boolean;
    tasks: unknown[];
    warnings: unknown[];
  };
  succeeded_at: string;
  failed_at: string | null;
  sync_frequency: number;
}

function getAuth(): string {
  const key    = process.env.FIVETRAN_API_KEY;
  const secret = process.env.FIVETRAN_API_SECRET;
  if (!key || !secret) throw new Error("FIVETRAN_API_KEY / FIVETRAN_API_SECRET not set");
  return Buffer.from(`${key}:${secret}`).toString("base64");
}

// MCP Tool: list_connectors
export async function listConnectors(): Promise<FivetranConnector[]> {
  const groupId = process.env.FIVETRAN_GROUP_ID;
  const url = groupId
    ? `https://api.fivetran.com/v1/groups/${groupId}/connectors`
    : "https://api.fivetran.com/v1/connectors";

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${getAuth()}`, Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`Fivetran API error: ${res.status}`);
  const data = await res.json();
  return data.data?.items ?? [];
}

// MCP Tool: get_connector_status
export async function getConnectorStatus(connectorId: string): Promise<FivetranConnector> {
  const res = await fetch(`https://api.fivetran.com/v1/connectors/${connectorId}`, {
    headers: { Authorization: `Basic ${getAuth()}`, Accept: "application/json" },
  });
  const data = await res.json();
  return data.data;
}

// MCP Tool: trigger_sync
export async function triggerSync(connectorId: string): Promise<boolean> {
  const res = await fetch(`https://api.fivetran.com/v1/connectors/${connectorId}/force`, {
    method: "POST",
    headers: { Authorization: `Basic ${getAuth()}`, Accept: "application/json" },
  });
  return res.ok;
}

// MCP Tool: check_data_freshness
// Returns whether all flood data sources are fresh enough for prediction
export async function checkDataFreshness(maxAgeHours = 6): Promise<{
  isFresh: boolean;
  staleSources: string[];
  lastSyncTimes: Record<string, string>;
  recommendation: string;
}> {
  try {
    const connectors = await listConnectors();
    const staleSources: string[] = [];
    const lastSyncTimes: Record<string, string> = {};

    for (const connector of connectors) {
      const lastSync = connector.succeeded_at ? new Date(connector.succeeded_at) : null;
      const hoursAgo = lastSync ? (Date.now() - lastSync.getTime()) / 3_600_000 : Infinity;

      lastSyncTimes[connector.schema] = connector.succeeded_at ?? "never";

      if (hoursAgo > maxAgeHours) {
        staleSources.push(connector.schema);
      }
    }

    return {
      isFresh: staleSources.length === 0,
      staleSources,
      lastSyncTimes,
      recommendation:
        staleSources.length > 0
          ? `Trigger sync for: ${staleSources.join(", ")} before prediction`
          : "All data sources fresh — proceeding with prediction",
    };
  } catch {
    // Graceful fallback when Fivetran is not configured
    return {
      isFresh: true,
      staleSources: [],
      lastSyncTimes: {},
      recommendation: "Fivetran MCP not configured — using direct API data",
    };
  }
}

// MCP tool definitions for Gemini function calling
export const FIVETRAN_MCP_TOOLS = [
  {
    name: "fivetran_list_connectors",
    description: "List all Fivetran data connectors and their sync status",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "fivetran_check_freshness",
    description:
      "Check if all flood data sources are fresh enough for accurate prediction. Returns stale sources and recommendation.",
    parameters: {
      type: "object",
      properties: {
        max_age_hours: {
          type: "number",
          description: "Maximum acceptable data age in hours (default: 6)",
        },
      },
      required: [],
    },
  },
  {
    name: "fivetran_trigger_sync",
    description: "Trigger a manual data sync for a specific connector",
    parameters: {
      type: "object",
      properties: {
        connector_id: {
          type: "string",
          description: "The Fivetran connector ID to sync",
        },
      },
      required: ["connector_id"],
    },
  },
];
