-- River gauge stations (BWDB reference data)
CREATE TABLE river_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT UNIQUE NOT NULL,
  station_name TEXT NOT NULL,
  river_name TEXT NOT NULL,
  district TEXT NOT NULL,
  upazila TEXT NOT NULL,
  division TEXT NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  danger_level DECIMAL(6,2),
  warning_level DECIMAL(6,2),
  normal_level DECIMAL(6,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time-series river gauge readings
CREATE TABLE river_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT REFERENCES river_stations(station_id),
  water_level DECIMAL(6,2) NOT NULL,
  flow_rate DECIMAL(10,2),
  reading_time TIMESTAMPTZ NOT NULL,
  source TEXT DEFAULT 'bwdb',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_river_readings_station_time ON river_readings(station_id, reading_time DESC);

-- Rainfall data (NASA IMERG + BMD)
CREATE TABLE rainfall_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upazila TEXT NOT NULL,
  district TEXT NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  rainfall_mm DECIMAL(8,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_rainfall_upazila_time ON rainfall_data(upazila, recorded_at DESC);

-- Weather forecasts (NOAA GFS)
CREATE TABLE weather_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upazila TEXT NOT NULL,
  district TEXT NOT NULL,
  forecast_for TIMESTAMPTZ NOT NULL,
  rainfall_forecast_mm DECIMAL(8,2),
  temperature_c DECIMAL(5,2),
  humidity_pct DECIMAL(5,2),
  wind_speed_kmh DECIMAL(6,2),
  source TEXT DEFAULT 'noaa_gfs',
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_forecast_upazila_time ON weather_forecasts(upazila, forecast_for);

-- Administrative units with elevation
CREATE TABLE upazilas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upazila_name TEXT NOT NULL,
  district TEXT NOT NULL,
  division TEXT NOT NULL,
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  elevation_m DECIMAL(8,2),
  area_sq_km DECIMAL(10,2),
  population INTEGER,
  is_flood_prone BOOLEAN DEFAULT false,
  nearby_station_ids TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent flood predictions
CREATE TABLE flood_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upazila TEXT NOT NULL,
  district TEXT NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) NOT NULL,
  risk_score DECIMAL(5,2) NOT NULL,
  risk_48h TEXT CHECK (risk_48h IN ('low', 'medium', 'high', 'critical')),
  risk_72h TEXT CHECK (risk_72h IN ('low', 'medium', 'high', 'critical')),
  reasoning TEXT NOT NULL,
  reasoning_bn TEXT,
  key_signals JSONB,
  input_snapshot JSONB,
  arize_trace_id TEXT,
  predicted_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ
);
CREATE INDEX idx_predictions_upazila_time ON flood_predictions(upazila, predicted_at DESC);

-- Ground truth flood events (for Arize feedback loop)
CREATE TABLE flood_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upazila TEXT NOT NULL,
  district TEXT NOT NULL,
  event_date DATE NOT NULL,
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'severe', 'catastrophic')),
  affected_population INTEGER,
  source TEXT NOT NULL,
  notes TEXT,
  confirmed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alert dispatch log
CREATE TABLE alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id UUID REFERENCES flood_predictions(id),
  upazila TEXT NOT NULL,
  district TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('sms', 'whatsapp', 'dashboard')) NOT NULL,
  message_en TEXT,
  message_bn TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'sent',
  twilio_sid TEXT
);

-- Data sync tracking (Fivetran jobs)
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  sync_type TEXT NOT NULL,
  records_fetched INTEGER DEFAULT 0,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE river_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE river_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE rainfall_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE upazilas ENABLE ROW LEVEL SECURITY;
ALTER TABLE flood_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE flood_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Public read on predictions and alerts (for dashboard)
CREATE POLICY "Public can read predictions" ON flood_predictions FOR SELECT USING (true);
CREATE POLICY "Public can read alerts" ON alerts_sent FOR SELECT USING (true);
CREATE POLICY "Public can read upazilas" ON upazilas FOR SELECT USING (true);
CREATE POLICY "Public can read river stations" ON river_stations FOR SELECT USING (true);
CREATE POLICY "Public can read river readings" ON river_readings FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access predictions" ON flood_predictions USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access readings" ON river_readings USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access rainfall" ON rainfall_data USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access forecasts" ON weather_forecasts USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access alerts" ON alerts_sent USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access sync" ON sync_logs USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access events" ON flood_events USING (auth.role() = 'service_role');
