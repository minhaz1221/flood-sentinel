export interface MonitoringLocation {
  lat: number;
  lon: number;
  upazila: string;
  district: string;
  division: string;
}

export const MONITORING_LOCATIONS: MonitoringLocation[] = [
  { lat: 24.8917, lon: 91.8833, upazila: "Sylhet Sadar",     district: "Sylhet",     division: "Sylhet"     },
  { lat: 24.8667, lon: 91.4167, upazila: "Sunamganj Sadar",  district: "Sunamganj",  division: "Sylhet"     },
  { lat: 24.9833, lon: 89.6667, upazila: "Islampur",          district: "Jamalpur",   division: "Mymensingh" },
  { lat: 24.4535, lon: 89.7002, upazila: "Sirajganj Sadar",  district: "Sirajganj",  division: "Rajshahi"   },
  { lat: 24.8703, lon: 90.7278, upazila: "Netrokona Sadar",  district: "Netrokona",  division: "Mymensingh" },
  { lat: 24.4449, lon: 90.7766, upazila: "Kishoreganj Sadar",district: "Kishoreganj",division: "Dhaka"      },
  { lat: 25.0197, lon: 90.0153, upazila: "Sherpur Sadar",    district: "Sherpur",    division: "Mymensingh" },
  { lat: 24.7471, lon: 90.4203, upazila: "Mymensingh Sadar", district: "Mymensingh", division: "Mymensingh" },
];
