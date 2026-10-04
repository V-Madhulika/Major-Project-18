import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  ButtonGroup,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Layers,
  Warning,
  Security,
  MyLocation,
} from '@mui/icons-material';
import { EmergencyAlert } from '../services/api';

// Predefined Geofencing Zones based on real topography, crime data & hazards
export interface GeofenceZone {
  id: string;
  name: string;
  type: 'DANGER' | 'CAUTION' | 'SAFE';
  center: [number, number]; // [lat, lng]
  radius: number; // meters
  description: string;
  riskFactor: string;
}

export const GEOFENCE_ZONES: GeofenceZone[] = [
  {
    id: 'zone-1',
    name: 'Anjuna Rocky Cliff Edge',
    type: 'DANGER',
    center: [15.586, 73.742],
    radius: 450,
    description: 'Steep unsecured cliff face & treacherous footing after dusk.',
    riskFactor: 'Topographical Hazard (GSI Survey)',
  },
  {
    id: 'zone-2',
    name: 'Aguada Deep Waters Rip Currents',
    type: 'DANGER',
    center: [15.492, 73.771],
    radius: 600,
    description: 'High-tide rip currents & submerged reef hazards.',
    riskFactor: 'IMD Coastal Warning Zone',
  },
  {
    id: 'zone-3',
    name: 'Chorla Forest Dead-Zone',
    type: 'DANGER',
    center: [15.652, 74.120],
    radius: 850,
    description: 'Dense wildlife corridor with zero cellular reception.',
    riskFactor: 'Telecom Dead Zone / Wildlife Sanctuary',
  },
  {
    id: 'zone-4',
    name: 'Calangute High-Density Night Zone',
    type: 'CAUTION',
    center: [15.544, 73.755],
    radius: 500,
    description: 'Heavy nightlife crowd density, isolated dark alleys.',
    riskFactor: 'NCRB Incident Density Index',
  },
  {
    id: 'zone-5',
    name: 'Chapora Fort Outer Trail',
    type: 'CAUTION',
    center: [15.606, 73.736],
    radius: 400,
    description: 'Slippery gravel path with no mobile lighting.',
    riskFactor: 'Terrain Risk Index',
  },
  {
    id: 'zone-6',
    name: 'Panaji Heritage Safe Promenade',
    type: 'SAFE',
    center: [15.4989, 73.8278],
    radius: 700,
    description: '24/7 CCTV surveillance, tourist police assistance booth.',
    riskFactor: 'Verified Safe Tourist Corridor',
  },
  {
    id: 'zone-7',
    name: 'Baga Patrolled Beach Hub',
    type: 'SAFE',
    center: [15.555, 73.751],
    radius: 500,
    description: 'Active lifeguard stations and police kiosk.',
    riskFactor: 'Verified Safe Tourist Corridor',
  },
];

interface RealTimeMapProps {
  alerts: EmergencyAlert[];
  onResolveAlert?: (alertId: string, alertType: string) => void;
  selectedLocation?: { latitude: number; longitude: number } | null;
}

export const RealTimeMap: React.FC<RealTimeMapProps> = ({
  alerts,
  onResolveAlert,
  selectedLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const geofenceLayerRef = useRef<any>(null);

  const [activeFilter, setActiveFilter] = useState<'ALL' | 'DANGER' | 'ALERTS' | 'SAFE'>('ALL');
  const [mapReady, setMapReady] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Default center around coastal tourist hub (Panaji / North Goa)
    const map = L.map(mapContainerRef.current, {
      center: [15.525, 73.785],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    // Add high-resolution OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Create feature groups for clean layer management
    const geofenceGroup = L.featureGroup().addTo(map);
    const markersGroup = L.featureGroup().addTo(map);

    geofenceLayerRef.current = geofenceGroup;
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;
    setMapReady(true);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Render Geofence Zones & Alert Markers whenever map is ready or alerts/filter change
  useEffect(() => {
    const L = (window as any).L;
    if (!mapReady || !mapInstanceRef.current || !L) return;

    const geofenceGroup = geofenceLayerRef.current;
    const markersGroup = markersLayerRef.current;

    geofenceGroup.clearLayers();
    markersGroup.clearLayers();

    // 1. Draw Geofence Polygons / Circles
    GEOFENCE_ZONES.forEach((zone) => {
      // Check filters
      if (activeFilter === 'DANGER' && zone.type !== 'DANGER') return;
      if (activeFilter === 'SAFE' && zone.type !== 'SAFE') return;
      if (activeFilter === 'ALERTS') return; // Hide zones if focusing strictly on alerts

      let color = '#2e7d32'; // green
      let fillColor = '#4caf50';
      let icon = '🛡️';

      if (zone.type === 'DANGER') {
        color = '#d32f2f'; // red
        fillColor = '#ef5350';
        icon = '⛔';
      } else if (zone.type === 'CAUTION') {
        color = '#ed6c02'; // orange/amber
        fillColor = '#ff9800';
        icon = '⚠️';
      }

      const circle = L.circle(zone.center, {
        color: color,
        fillColor: fillColor,
        fillOpacity: zone.type === 'DANGER' ? 0.35 : 0.2,
        weight: 2,
        dashArray: zone.type === 'DANGER' ? '6, 6' : undefined,
        radius: zone.radius,
      });

      const popupContent = `
        <div style="font-family: system-ui, sans-serif; min-width: 200px; padding: 4px;">
          <div style="font-weight: bold; font-size: 14px; color: ${color}; margin-bottom: 4px;">
            ${icon} ${zone.name}
          </div>
          <div style="font-size: 12px; color: #444; margin-bottom: 6px;">
            ${zone.description}
          </div>
          <div style="font-size: 11px; background: #f5f5f5; padding: 4px 6px; border-radius: 4px; color: #666;">
            <strong>Basis:</strong> ${zone.riskFactor}
          </div>
          <div style="font-size: 11px; color: #888; margin-top: 4px;">
            Radius: ${zone.radius}m | Geofence Type: <strong>${zone.type}</strong>
          </div>
        </div>
      `;

      circle.bindPopup(popupContent);
      geofenceGroup.addLayer(circle);
    });

    // 2. Draw Active Emergency Alerts Markers
    alerts.forEach((alert) => {
      if (!alert.location || !alert.location.latitude || !alert.location.longitude) return;

      const isCritical = alert.priority === 'CRITICAL' || alert.emergencyType === 'panic' || alert.type === 'panic';
      const isActive = alert.status === 'ACTIVE';

      // Pulse animation style for active alerts
      const pulseHtml = `
        <div style="
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        ">
          ${isActive ? `
            <div style="
              position: absolute;
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background: rgba(244, 67, 54, 0.4);
              animation: mapPulse 1.5s infinite ease-out;
            "></div>
          ` : ''}
          <div style="
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: ${isActive ? (isCritical ? '#d32f2f' : '#f57c00') : '#2e7d32'};
            border: 2px solid #ffffff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: #ffffff;
          ">
            ${isActive ? '🚨' : '✅'}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-alert-pin',
        html: pulseHtml,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([alert.location.latitude, alert.location.longitude], {
        icon: customIcon,
      });

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 230px; padding: 4px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: bold; font-size: 14px; color: ${isActive ? '#d32f2f' : '#2e7d32'};">
              ${isActive ? '🚨 ACTIVE SOS' : '✅ RESOLVED'}
            </span>
            <span style="font-size: 10px; background: #e0e0e0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
              ${alert.priority || 'HIGH'}
            </span>
          </div>
          <div style="font-size: 12px; margin-bottom: 4px;">
            <strong>Tourist ID:</strong> <code>${alert.digitalId || 'Unknown'}</code>
          </div>
          <div style="font-size: 12px; margin-bottom: 4px;">
            <strong>Type:</strong> ${alert.emergencyType || alert.type || 'Emergency'}
          </div>
          <div style="font-size: 12px; color: #333; margin-bottom: 6px; background: #fff3e0; padding: 4px 6px; border-radius: 4px;">
            "${alert.message || 'Emergency assistance requested'}"
          </div>
          <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
            GPS: ${alert.location.latitude.toFixed(5)}, ${alert.location.longitude.toFixed(5)}
          </div>
          ${isActive ? `
            <button 
              id="resolve-btn-${alert.alertId}" 
              style="
                width: 100%;
                background: #2e7d32;
                color: #ffffff;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 12px;
              "
            >
              ✅ Acknowledge & Resolve
            </button>
          ` : ''}
        </div>
      `;

      marker.bindPopup(popupHtml);

      // Bind click handler for button inside popup
      marker.on('popupopen', () => {
        const btn = document.getElementById(`resolve-btn-${alert.alertId}`);
        if (btn && onResolveAlert) {
          btn.onclick = () => {
            onResolveAlert(alert.alertId, alert.emergencyType || alert.type || 'Emergency');
            marker.closePopup();
          };
        }
      });

      markersGroup.addLayer(marker);
    });
  }, [mapReady, alerts, activeFilter, onResolveAlert]);

  // Smoothly Fly to Selected Location when clicked from alert table
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !selectedLocation) return;
    mapInstanceRef.current.flyTo(
      [selectedLocation.latitude, selectedLocation.longitude],
      15,
      { duration: 1.2 }
    );
  }, [selectedLocation, mapReady]);

  // Center map back to operational area
  const handleResetView = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([15.525, 73.785], 12, { duration: 1.0 });
    }
  };

  return (
    <Card sx={{ mb: 3, boxShadow: 3, borderRadius: 2, overflow: 'hidden' }}>
      {/* Pulse keyframe definition in document */}
      <style>
        {`
          @keyframes mapPulse {
            0% { transform: scale(0.8); opacity: 0.9; }
            50% { transform: scale(1.6); opacity: 0.2; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          .custom-alert-pin {
            background: transparent;
            border: none;
          }
        `}
      </style>

      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              🗺️ Real-Time Safety & Geofence Monitoring Map
              <Chip
                label="LIVE TELEMETRY STREAMING"
                size="small"
                color="success"
                sx={{ fontSize: '10px', height: '22px', fontWeight: 'bold' }}
              />
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live tourist positions, dynamic risk corridors, and real-time geofence violation feeds
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            {/* Filter buttons */}
            <ButtonGroup size="small" variant="outlined">
              <Button
                variant={activeFilter === 'ALL' ? 'contained' : 'outlined'}
                onClick={() => setActiveFilter('ALL')}
                startIcon={<Layers />}
              >
                All Zones
              </Button>
              <Button
                variant={activeFilter === 'DANGER' ? 'contained' : 'outlined'}
                color="error"
                onClick={() => setActiveFilter('DANGER')}
                startIcon={<Warning />}
              >
                Danger Only
              </Button>
              <Button
                variant={activeFilter === 'SAFE' ? 'contained' : 'outlined'}
                color="success"
                onClick={() => setActiveFilter('SAFE')}
                startIcon={<Security />}
              >
                Safe Hubs
              </Button>
            </ButtonGroup>

            <Tooltip title="Reset View to Region">
              <Button
                size="small"
                variant="outlined"
                onClick={handleResetView}
                startIcon={<MyLocation />}
              >
                Center
              </Button>
            </Tooltip>
          </Stack>
        </Box>

        {/* Embedded Map Container */}
        <Box
          ref={mapContainerRef}
          sx={{
            height: 480,
            width: '100%',
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid #e0e0e0',
            bgcolor: '#f5f5f5',
            position: 'relative',
          }}
        />

        {/* Map Legend */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1.5, alignItems: 'center', bgcolor: '#fafafa', p: 1, borderRadius: 1 }}>
          <Typography variant="caption" fontWeight="bold" color="text.secondary">
            LEGEND:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ef5350', border: '1px dashed #d32f2f' }} />
            <Typography variant="caption">High-Risk Danger Geofence</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff9800', opacity: 0.6 }} />
            <Typography variant="caption">Cautionary Buffer Zone</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#4caf50', opacity: 0.5 }} />
            <Typography variant="caption">Safe Patrolled Corridor</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <span style={{ fontSize: '13px' }}>🚨</span>
            <Typography variant="caption" fontWeight="bold" color="error">
              Active SOS Incident ({alerts.filter(a => a.status === 'ACTIVE').length})
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default RealTimeMap;
