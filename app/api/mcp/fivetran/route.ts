// MCP HTTP endpoint — exposes Fivetran tools following Model Context Protocol
import { listConnectors, getConnectorStatus, triggerSync, checkDataFreshness, FIVETRAN_MCP_TOOLS } from "@/lib/mcp/fivetran";

export async function GET() {
  return Response.json({
    name: "flood-sentinel-fivetran-mcp",
    version: "1.0.0",
    description: "Fivetran MCP integration for Flood Sentinel data pipeline management",
    protocol: "Model Context Protocol v1.0",
    tools: FIVETRAN_MCP_TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
}

export async function POST(request: Request) {
  let body: { tool?: string; input?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { tool, input = {} } = body;

  try {
    switch (tool) {
      case "fivetran_list_connectors": {
        const connectors = await listConnectors();
        return Response.json({
          success: true,
          tool,
          result: connectors.map((c) => ({
            id:         c.id,
            service:    c.service,
            schema:     c.schema,
            sync_state: c.status.sync_state,
            last_sync:  c.succeeded_at,
            has_errors: !!c.failed_at,
          })),
        });
      }

      case "fivetran_check_freshness": {
        const maxAgeHours = typeof input.max_age_hours === "number" ? input.max_age_hours : 6;
        const freshness = await checkDataFreshness(maxAgeHours);
        return Response.json({ success: true, tool, result: freshness });
      }

      case "fivetran_trigger_sync": {
        const connectorId = input.connector_id;
        if (typeof connectorId !== "string") {
          return Response.json({ success: false, error: "connector_id required" }, { status: 400 });
        }
        const triggered = await triggerSync(connectorId);
        return Response.json({ success: triggered, tool, result: { triggered, connector_id: connectorId } });
      }

      case "fivetran_get_connector": {
        const connectorId = input.connector_id;
        if (typeof connectorId !== "string") {
          return Response.json({ success: false, error: "connector_id required" }, { status: 400 });
        }
        const connector = await getConnectorStatus(connectorId);
        return Response.json({ success: true, tool, result: connector });
      }

      default:
        return Response.json({ success: false, error: `Unknown MCP tool: ${tool}` }, { status: 400 });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
