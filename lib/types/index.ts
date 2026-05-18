export type RiskLevel = "low" | "medium" | "high" | "critical";
export type FloodSeverity = "minor" | "moderate" | "severe" | "catastrophic";
export type AlertChannel = "sms" | "whatsapp" | "dashboard";

export interface RiverStation {
  id: string;
  station_id: string;
  station_name: string;
  river_name: string;
  district: string;
  upazila: string;
  division: string;
  latitude: number;
  longitude: number;
  danger_level: number | null;
  warning_level: number | null;
  normal_level: number | null;
  is_active: boolean;
  created_at: string;
}

export interface RiverReading {
  id: string;
  station_id: string;
  water_level: number;
  flow_rate: number | null;
  reading_time: string;
  source: string;
  created_at: string;
}

export interface RainfallData {
  id: string;
  upazila: string;
  district: string;
  latitude: number;
  longitude: number;
  rainfall_mm: number;
  recorded_at: string;
  source: string;
  created_at: string;
}

export interface WeatherForecast {
  id: string;
  upazila: string;
  district: string;
  forecast_for: string;
  rainfall_forecast_mm: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_speed_kmh: number | null;
  source: string;
  fetched_at: string;
}

export interface Upazila {
  id: string;
  upazila_name: string;
  district: string;
  division: string;
  latitude: number;
  longitude: number;
  elevation_m: number | null;
  area_sq_km: number | null;
  population: number | null;
  is_flood_prone: boolean;
  nearby_station_ids: string[] | null;
  created_at: string;
}

export interface FloodPrediction {
  id: string;
  upazila: string;
  district: string;
  risk_level: RiskLevel;
  risk_score: number;
  risk_48h: RiskLevel | null;
  risk_72h: RiskLevel | null;
  reasoning: string;
  reasoning_bn: string | null;
  key_signals: Record<string, unknown> | null;
  input_snapshot: Record<string, unknown> | null;
  arize_trace_id: string | null;
  predicted_at: string;
  valid_until: string | null;
}

export interface FloodEvent {
  id: string;
  upazila: string;
  district: string;
  event_date: string;
  severity: FloodSeverity | null;
  affected_population: number | null;
  source: string;
  notes: string | null;
  confirmed_at: string;
}

export interface AlertSent {
  id: string;
  prediction_id: string | null;
  upazila: string;
  district: string;
  channel: AlertChannel;
  message_en: string | null;
  message_bn: string;
  recipient_count: number;
  sent_at: string;
  status: string;
  twilio_sid: string | null;
}

export interface SyncLog {
  id: string;
  source: string;
  sync_type: string;
  records_fetched: number;
  status: string;
  error_message: string | null;
  started_at: string | null;
  completed_at: string;
}

// --- Sync result types ---

export interface SyncResult {
  source: string;
  records_fetched: number;
  status: "success" | "error";
  error?: string;
}

export interface BwdbSyncResult {
  success: boolean;
  recordsFetched: number;
  errors: string[];
}

export interface SeedResult {
  success: boolean;
  recordsInserted: number;
  errors: string[];
}

// --- Open-Meteo API shapes ---

export interface OpenMeteoHourlyResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: {
    time: string[];
    precipitation: (number | null)[];
    temperature_2m?: (number | null)[];
    relativehumidity_2m?: (number | null)[];
    windspeed_10m?: (number | null)[];
    precipitation_probability?: (number | null)[];
    weathercode?: (number | null)[];
  };
  daily?: {
    time: string[];
    precipitation_sum: (number | null)[];
    precipitation_probability_max: (number | null)[];
  };
}

export interface RainfallReading {
  upazila: string;
  district: string;
  latitude: number;
  longitude: number;
  rainfall_mm: number;
  recorded_at: string;
  source: string;
}

export interface ForecastReading {
  upazila: string;
  district: string;
  forecast_for: string;
  rainfall_forecast_mm: number;
  temperature_c: number | null;
  humidity_pct: number | null;
  wind_speed_kmh: number | null;
  source: string;
}

// --- API payload shapes ---

export interface PredictionWithStation extends FloodPrediction {
  nearby_stations?: RiverStation[];
  latest_readings?: RiverReading[];
}

export interface AgentPredictionInput {
  upazila: string;
  district: string;
  river_readings: RiverReading[];
  rainfall_24h: number;
  rainfall_72h: number;
  forecast_mm: number;
  station_danger_levels: Array<{
    station_id: string;
    station_name: string;
    water_level: number;
    danger_level: number | null;
    warning_level: number | null;
  }>;
}

export interface AgentPredictionOutput {
  risk_level: RiskLevel;
  risk_score: number;
  risk_48h: RiskLevel;
  risk_72h: RiskLevel;
  reasoning: string;
  reasoning_bn: string;
  key_signals: Record<string, unknown>;
}

export interface AlertDispatchRequest {
  prediction_id: string;
  channels: AlertChannel[];
}

// --- Agent layer types ---

export interface GeminiKeySignal {
  label: string;
  value: string | number;
  unit?: string;
  severity: "normal" | "warning" | "danger" | "critical";
}

export interface StationSignal {
  station_id: string;
  station_name: string;
  water_level: number;
  danger_level: number | null;
  warning_level: number | null;
  pct_of_danger: number | null;
  trend: "rising" | "falling" | "stable";
  is_upstream: boolean;
}

export interface UpazilaContext {
  upazila: string;
  district: string;
  stations: StationSignal[];
  upstream_stations: StationSignal[];
  rainfall_24h_mm: number;
  rainfall_48h_mm: number;
  rainfall_72h_mm: number;
  forecast_24h_mm: number;
  forecast_48h_mm: number;
  forecast_72h_mm: number;
  max_danger_pct: number | null;
  any_above_danger: boolean;
  any_above_warning: boolean;
  upstream_threat: boolean;
  monsoon_season: boolean;
  as_of: string;
}

export interface PredictionResult {
  upazila: string;
  district: string;
  risk_level: RiskLevel;
  risk_score: number;
  risk_48h: RiskLevel;
  risk_72h: RiskLevel;
  reasoning: string;
  reasoning_bn: string;
  key_signals: GeminiKeySignal[];
}

export interface AccuracyMetrics {
  total_evaluated: number;
  correct: number;
  accuracy_pct: number;
  by_risk_level: Record<RiskLevel, { predicted: number; correct: number }>;
  false_negatives: number;
  false_positives: number;
}

export interface EvaluationReport {
  generated_at: string;
  date_range: { from: string; to: string };
  metrics: AccuracyMetrics;
  suggestions: string[];
}

export interface ArizeTrace {
  trace_id: string;
  upazila: string;
  district: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  risk_level: RiskLevel;
  risk_score: number;
  model: string;
  timestamp: string;
}

// --- Mode-based API request shapes ---

export interface AgentSingleRequest {
  mode: "single";
  upazila: string;
  district: string;
}

export interface AgentAllRequest {
  mode: "all";
}

export interface AgentHistoricalRequest {
  mode: "historical";
  targetDate: string; // ISO date string e.g. "2022-06-16"
  upazila?: string;
}

export type AgentRequest = AgentSingleRequest | AgentAllRequest | AgentHistoricalRequest;
