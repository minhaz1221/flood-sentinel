export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Only initialize full OTel tracing in production with Arize credentials
  const isProduction = process.env.NODE_ENV === "production";
  const arizeApiKey = process.env.ARIZE_API_KEY;
  const arizeSpaceId = process.env.ARIZE_SPACE_ID;

  if (!isProduction || !arizeApiKey || !arizeSpaceId) return;

  try {
    const [sdkMod, resMod, expMod] = await Promise.all([
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/exporter-trace-otlp-http"),
    ]);

    // Handle both CJS-wrapped and named export styles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NodeSDK = (sdkMod as any).NodeSDK ?? (sdkMod as any).default?.NodeSDK;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ResourceCls = (resMod as any).Resource ?? (resMod as any).default?.Resource;
    const { OTLPTraceExporter } = expMod;

    if (!NodeSDK || !ResourceCls) {
      console.warn("[instrumentation] OTel SDK classes not found — skipping");
      return;
    }

    const sdk = new NodeSDK({
      resource: new ResourceCls({ "service.name": "flood-sentinel", "service.version": "1.0.0" }),
      traceExporter: new OTLPTraceExporter({
        url: "https://otlp.arize.com/v1/traces",
        headers: {
          Authorization: `Bearer ${arizeApiKey}`,
          "space-id": arizeSpaceId,
        },
      }),
    });

    sdk.start();
    console.log("[instrumentation] OTel → Arize initialized");
  } catch (err) {
    console.warn("[instrumentation] OTel init failed:", err instanceof Error ? err.message : err);
  }
}
