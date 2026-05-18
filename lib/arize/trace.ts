import { trace, SpanStatusCode } from "@opentelemetry/api";

export interface TracePayload {
  trace_id: string;
  upazila: string;
  district: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latency_ms: number;
  mcp?: {
    tool: string;
    result: string;
    data_fresh: boolean;
  };
}

export async function logPredictionTrace(payload: TracePayload): Promise<void> {
  const tracer = trace.getTracer("flood-sentinel", "1.0.0");
  const span = tracer.startSpan("flood_prediction", {
    startTime: Date.now() - payload.latency_ms,
  });

  try {
    // ── OpenInference semantic conventions (Arize Phoenix) ────────────────
    span.setAttribute("openinference.span.kind", "CHAIN");

    // Input / output as JSON strings
    span.setAttribute("input.value",  JSON.stringify(payload.input));
    span.setAttribute("output.value", JSON.stringify({
      risk_level:  payload.output.risk_level,
      risk_score:  payload.output.risk_score,
      risk_48h:    payload.output.risk_48h,
      risk_72h:    payload.output.risk_72h,
    }));
    span.setAttribute("input.mime_type",  "application/json");
    span.setAttribute("output.mime_type", "application/json");

    // Metadata attributes
    span.setAttribute("metadata.upazila",         payload.upazila);
    span.setAttribute("metadata.district",        payload.district);
    span.setAttribute("metadata.model",           "gemini-2.5-flash");
    span.setAttribute("metadata.prediction_date", new Date().toISOString());
    span.setAttribute("metadata.latency_ms",      payload.latency_ms);

    // LLM-specific attributes
    span.setAttribute("llm.system",       "gemini");
    span.setAttribute("llm.model_name",   "gemini-2.5-flash");
    span.setAttribute("llm.request_type", "chat");

    // MCP integration attributes
    if (payload.mcp) {
      span.setAttribute("mcp.tool",       payload.mcp.tool);
      span.setAttribute("mcp.result",     payload.mcp.result);
      span.setAttribute("mcp.data_fresh", payload.mcp.data_fresh);
    }

    // Flood-Sentinel custom
    span.setAttribute("flood_sentinel.trace_id",  payload.trace_id);
    span.setAttribute("flood_sentinel.risk_level",
      typeof payload.output.risk_level === "string" ? payload.output.risk_level : "unknown");
    if (typeof payload.output.risk_score === "number") {
      span.setAttribute("flood_sentinel.risk_score", payload.output.risk_score);
    }

    span.setStatus({ code: SpanStatusCode.OK });
  } catch (err) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err instanceof Error ? err.message : String(err),
    });
    span.recordException(err instanceof Error ? err : new Error(String(err)));
  } finally {
    span.end();
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[trace] ${payload.trace_id} | ${payload.upazila} | ${payload.latency_ms}ms` +
      ` | risk=${payload.output.risk_level ?? "?"}/${payload.output.risk_score ?? "?"}`
    );
  }
}

// Annotation span for accuracy feedback (called when flood_event confirmed)
export async function logAccuracyAnnotation(opts: {
  prediction_trace_id: string;
  upazila: string;
  predicted: string;
  actual: string;
  label: "correct" | "false_positive" | "missed";
  score: number;
}): Promise<void> {
  const tracer = trace.getTracer("flood-sentinel", "1.0.0");
  const span = tracer.startSpan("flood_prediction_accuracy");

  try {
    span.setAttribute("openinference.span.kind", "EVALUATOR");
    span.setAttribute("eval.name",    "flood_prediction_accuracy");
    span.setAttribute("eval.label",   opts.label);
    span.setAttribute("eval.score",   opts.score);
    span.setAttribute("metadata.upazila",         opts.upazila);
    span.setAttribute("metadata.predicted_risk",  opts.predicted);
    span.setAttribute("metadata.actual_severity", opts.actual);
    span.setAttribute("metadata.source_trace_id", opts.prediction_trace_id);
    span.setStatus({ code: SpanStatusCode.OK });
  } finally {
    span.end();
  }
}
