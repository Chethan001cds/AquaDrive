"use client";

import { useEffect, useRef, useState } from "react";

export interface LocationAddressDetails {
  road?: string;
  suburb?: string;
  city?: string;
  postcode?: string;
  houseNumber?: string;
}

interface LocationPickerProps {
  onLocationSelect: (
    lat: number,
    lng: number,
    address?: string,
    details?: LocationAddressDetails
  ) => void;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
}

export default function LocationPicker({
  onLocationSelect,
  initialLat,
  initialLng,
  initialAddress,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const accuracyCircleRef = useRef<any>(null);
  const streetLayerRef = useRef<any>(null);
  const satelliteLayerRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState("");
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapLayer, setMapLayer] = useState<"street" | "satellite">("street");
  const [currentZoom, setCurrentZoom] = useState(15);
  const [accuracyMsg, setAccuracyMsg] = useState("");
  const [selectedCoords, setSelectedCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  // Initialize Leaflet strictly on client side
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      if (mapInstanceRef.current) return;

      try {
        const leafletModule = await import("leaflet");
        const L = leafletModule.default || leafletModule;
        LRef.current = L;

        if (!isMounted || !mapContainerRef.current) return;

        // Custom pinpoint SVG icon with exact bottom-anchor
        const customIcon = L.divIcon({
          className: "custom-map-pin",
          html: `
            <div style="position: relative; width: 40px; height: 48px; transform: translate(-20px, -48px);">
              <!-- Pulsing ground target ring -->
              <div style="position: absolute; bottom: 0; left: 14px; width: 12px; height: 12px; background: rgba(37, 99, 235, 0.4); border: 2px solid #2563eb; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <!-- Center pinpoint -->
              <div style="position: absolute; bottom: 3px; left: 17px; width: 6px; height: 6px; background: #dc2626; border-radius: 50%;"></div>
              <!-- Marker Pin -->
              <svg viewBox="0 0 24 24" width="40" height="40" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.45));">
                <path fill="#2563eb" stroke="#ffffff" stroke-width="1.2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="3.2" fill="#ffffff" />
                <circle cx="12" cy="9" r="1.8" fill="#2563eb" />
              </svg>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const defaultLat = initialLat || 12.9716;
        const defaultLng = initialLng || 77.5946;
        const defaultZoom = initialLat ? 17 : 14;

        // 1. Street layer (OpenStreetMap)
        const streetLayer = L.tileLayer(
          "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 19,
          }
        );
        streetLayerRef.current = streetLayer;

        // 2. High-res Satellite layer (Esri World Imagery)
        const satelliteLayer = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            attribution:
              "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
            maxZoom: 19,
          }
        );
        satelliteLayerRef.current = satelliteLayer;

        const map = L.map(mapContainerRef.current, {
          center: [defaultLat, defaultLng],
          zoom: defaultZoom,
          zoomControl: false, // We provide custom large controls
          layers: [streetLayer],
        });

        mapInstanceRef.current = map;
        setCurrentZoom(defaultZoom);

        map.on("zoomend", () => {
          if (map) setCurrentZoom(map.getZoom());
        });

        // Place initial marker if coordinates provided
        if (initialLat && initialLng) {
          const marker = L.marker([initialLat, initialLng], {
            icon: customIcon,
            draggable: true,
          }).addTo(map);
          markerRef.current = marker;

          marker.on("dragend", () => {
            const pos = marker.getLatLng();
            setSelectedCoords({ lat: pos.lat, lng: pos.lng });
            reverseGeocode(pos.lat, pos.lng);
          });
        }

        // Click to place or move marker
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          setMarkerPosition(lat, lng, true);
        });

        // Trigger map resize check
        setTimeout(() => {
          if (map) map.invalidateSize();
        }, 200);

        setLoadingMap(false);
      } catch (err: any) {
        console.error("Map initialization failed:", err);
        if (isMounted) {
          setMapError("Interactive map could not load in this browser.");
          setLoadingMap(false);
        }
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        accuracyCircleRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When fullscreen changes, trigger map.invalidateSize()
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  function switchMapLayer(layer: "street" | "satellite") {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (layer === "satellite") {
      if (streetLayerRef.current) map.removeLayer(streetLayerRef.current);
      if (satelliteLayerRef.current) map.addLayer(satelliteLayerRef.current);
    } else {
      if (satelliteLayerRef.current) map.removeLayer(satelliteLayerRef.current);
      if (streetLayerRef.current) map.addLayer(streetLayerRef.current);
    }
    setMapLayer(layer);
  }

  function handleZoomIn() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  }

  function handleZoomOut() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  }

  function handleCenterOnPin() {
    if (mapInstanceRef.current && selectedCoords) {
      mapInstanceRef.current.setView([selectedCoords.lat, selectedCoords.lng], 18);
    }
  }

  function setMarkerPosition(lat: number, lng: number, fetchAddress = true, accuracy?: number) {
    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    setSelectedCoords({ lat, lng });

    const customIcon = L.divIcon({
      className: "custom-map-pin",
      html: `
        <div style="position: relative; width: 40px; height: 48px; transform: translate(-20px, -48px);">
          <!-- Pulsing ground target ring -->
          <div style="position: absolute; bottom: 0; left: 14px; width: 12px; height: 12px; background: rgba(37, 99, 235, 0.4); border: 2px solid #2563eb; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <!-- Center pinpoint -->
          <div style="position: absolute; bottom: 3px; left: 17px; width: 6px; height: 6px; background: #dc2626; border-radius: 50%;"></div>
          <!-- Marker Pin -->
          <svg viewBox="0 0 24 24" width="40" height="40" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.45));">
            <path fill="#2563eb" stroke="#ffffff" stroke-width="1.2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="3.2" fill="#ffffff" />
            <circle cx="12" cy="9" r="1.8" fill="#2563eb" />
          </svg>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      const marker = L.marker([lat, lng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setSelectedCoords({ lat: pos.lat, lng: pos.lng });
        reverseGeocode(pos.lat, pos.lng);
      });
    }

    // Draw accuracy circle if GPS accuracy provided
    if (accuracy && accuracy > 0) {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.setLatLng([lat, lng]);
        accuracyCircleRef.current.setRadius(accuracy);
      } else {
        accuracyCircleRef.current = L.circle([lat, lng], {
          radius: accuracy,
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          weight: 1.5,
        }).addTo(map);
      }
    } else if (accuracyCircleRef.current) {
      map.removeLayer(accuracyCircleRef.current);
      accuracyCircleRef.current = null;
    }

    // Zoom straight to high precision street level
    map.setView([lat, lng], 18);

    if (fetchAddress) {
      reverseGeocode(lat, lng);
    } else {
      onLocationSelect(lat, lng);
    }
  }

  async function reverseGeocode(lat: number, lng: number) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { "User-Agent": "AquaDrive-Doorstep-CarWash" } }
      );
      if (!res.ok) {
        onLocationSelect(lat, lng);
        return;
      }
      const data = await res.json();
      const address = data.display_name || "";
      const addrObj = data.address || {};
      const road =
        addrObj.road ||
        addrObj.street ||
        addrObj.residential ||
        addrObj.suburb ||
        addrObj.neighbourhood ||
        "";
      const details: LocationAddressDetails = {
        road: [road, addrObj.suburb].filter(Boolean).join(", ") || road,
        suburb: addrObj.suburb || addrObj.neighbourhood || addrObj.city_district || "",
        city: addrObj.city || addrObj.town || addrObj.village || addrObj.state_district || "",
        postcode: addrObj.postcode || "",
        houseNumber: addrObj.house_number || "",
      };
      onLocationSelect(lat, lng, address, details);
    } catch {
      onLocationSelect(lat, lng);
    }
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    setAccuracyMsg("Accessing high-accuracy GPS…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setMarkerPosition(latitude, longitude, true, accuracy);
        setLocating(false);
        const accMeters = Math.round(accuracy || 10);
        setAccuracyMsg(
          `GPS accurate to ~${accMeters}m. Drag pin to your exact parking spot or vehicle location.`
        );
      },
      (err) => {
        console.warn("Geolocation warning:", err.message);
        setLocating(false);
        setAccuracyMsg("");
        alert(
          "Could not detect precise GPS location automatically. Please use the search bar or click directly on the map."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function handleSearch(
    e?: React.FormEvent | React.MouseEvent | React.KeyboardEvent
  ) {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    // Check if user pasted coordinates e.g. "12.9716, 77.5946" or Google Maps link
    const coordMatch = query.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setMarkerPosition(lat, lng, true);
        setSearchQuery("");
        return;
      }
    }

    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(
          query
        )}&limit=1`,
        { headers: { "User-Agent": "AquaDrive-Doorstep-CarWash" } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        const address = data[0].display_name || query;
        const addrObj = data[0].address || {};
        const road =
          addrObj.road ||
          addrObj.street ||
          addrObj.residential ||
          addrObj.suburb ||
          addrObj.neighbourhood ||
          "";
        const details: LocationAddressDetails = {
          road: [road, addrObj.suburb].filter(Boolean).join(", ") || road,
          suburb: addrObj.suburb || addrObj.neighbourhood || addrObj.city_district || "",
          city: addrObj.city || addrObj.town || addrObj.village || addrObj.state_district || "",
          postcode: addrObj.postcode || "",
          houseNumber: addrObj.house_number || "",
        };
        setMarkerPosition(lat, lng, false);
        onLocationSelect(lat, lng, address, details);
        setSearchQuery("");
      } else {
        alert("Location not found. Try searching with your street, apartment, or city.");
      }
    } catch {
      alert("Search service currently busy. You can click directly on the map to place your pin.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <>
      {/* MAP WRAPPER CONTAINER (Changes to fixed full-screen overlay when isFullscreen is true) */}
      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-[9999] bg-white flex flex-col p-4 sm:p-6 shadow-2xl"
            : "rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-4 space-y-3.5 relative"
        }
      >
        {/* Fullscreen Header (only visible when maximized) */}
        {isFullscreen && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b border-gray-200 gap-3 mb-2">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>📍</span>
                <span>Pin Exact Vehicle / Doorstep Location</span>
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Zoom in close (up to house level) and drag the pin to your exact parking spot or vehicle.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-green-700 transition"
              >
                <span>✓ Done / Minimize</span>
              </button>
            </div>
          </div>
        )}

        {/* Top Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Action: Use My Location */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locating}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {locating ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  <span>Locating GPS…</span>
                </>
              ) : (
                <>
                  <span>🎯</span>
                  <span>Use My Exact GPS Location</span>
                </>
              )}
            </button>

            {/* Map Layer Switcher (Street vs Satellite) */}
            <div className="inline-flex rounded-xl border border-gray-300 bg-white p-0.5 shadow-sm text-xs font-semibold">
              <button
                type="button"
                onClick={() => switchMapLayer("street")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  mapLayer === "street"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-700 hover:text-gray-900"
                }`}
              >
                🗺️ Street
              </button>
              <button
                type="button"
                onClick={() => switchMapLayer("satellite")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  mapLayer === "satellite"
                    ? "bg-blue-600 text-white shadow"
                    : "text-gray-700 hover:text-gray-900"
                }`}
              >
                🛰️ Satellite
              </button>
            </div>
          </div>

          {/* Maximize / Minimize Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center gap-1.5 rounded-xl border border-blue-400 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm hover:bg-blue-50 transition"
              title={isFullscreen ? "Minimize Map" : "Maximize / Expand Map to Fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <span>🗗</span>
                  <span>Minimize Map</span>
                </>
              ) : (
                <>
                  <span>⛶</span>
                  <span>Maximize / Full Screen Map</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar (Uses div to prevent nested form HTML hydration error) */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Search apartment, colony, road, landmark or paste coordinates..."
            className="flex-1 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            type="button"
            onClick={() => handleSearch()}
            disabled={searching || !searchQuery.trim()}
            className="rounded-xl bg-gray-900 px-4 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-black disabled:opacity-50 transition"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </div>

        {/* MAP VIEW CONTAINER */}
        <div
          className={`relative overflow-hidden rounded-2xl border-2 border-gray-300 bg-gray-100 shadow-inner ${
            isFullscreen ? "flex-1 w-full" : "h-[360px] w-full"
          }`}
          style={isFullscreen ? { minHeight: "350px" } : { height: "360px" }}
        >
          {/* Map canvas */}
          <div ref={mapContainerRef} className="h-full w-full" />

          {/* Big, Easy-to-Tap Floating Zoom & Re-Center Controls */}
          <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2">
            <button
              type="button"
              onClick={handleZoomIn}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-xl font-bold text-gray-800 shadow-lg border border-gray-200 hover:bg-white active:scale-95 transition"
              title="Zoom In (Maximize Detail)"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-xl font-bold text-gray-800 shadow-lg border border-gray-200 hover:bg-white active:scale-95 transition"
              title="Zoom Out (Minimize View)"
            >
              −
            </button>
            {selectedCoords && (
              <button
                type="button"
                onClick={handleCenterOnPin}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/95 text-base font-bold text-blue-600 shadow-lg border border-gray-200 hover:bg-white active:scale-95 transition"
                title="Re-Center On Your Pin"
              >
                🎯
              </button>
            )}
          </div>

          {/* Current Zoom Level Pill */}
          <div className="absolute bottom-3 left-3 z-[400] rounded-lg bg-black/60 backdrop-blur-sm px-2.5 py-1 text-[11px] font-mono text-white shadow">
            Zoom: {currentZoom}x / 19x {currentZoom >= 17 ? "(Street Detail)" : ""}
          </div>

          {loadingMap && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/85 z-[500]">
              <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                <span>Loading map…</span>
              </div>
            </div>
          )}

          {mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-white p-4 text-center z-[500]">
              <p className="text-sm text-red-600 font-medium">{mapError}</p>
            </div>
          )}
        </div>

        {/* Bottom Helper & Status Info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-gray-600 gap-2 pt-1">
          <div className="space-y-0.5">
            {selectedCoords ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-green-700 flex items-center gap-1">
                  <span>✅</span>
                  <span>
                    Pin Point: {selectedCoords.lat.toFixed(6)}, {selectedCoords.lng.toFixed(6)}
                  </span>
                </span>
                <a
                  href={`https://www.google.com/maps?q=${selectedCoords.lat},${selectedCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  [Verify on Google Maps ↗]
                </a>
              </div>
            ) : (
              <span className="text-gray-600 font-medium">
                💡 Click on the map, search, or tap &quot;Use My Exact GPS Location&quot; to drop a pin.
              </span>
            )}

            {accuracyMsg && (
              <p className="text-blue-700 font-semibold">{accuracyMsg}</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-gray-500">
            <span>🖱️ Click map or drag pin to fine-tune exact gate</span>
          </div>
        </div>

        {/* If in fullscreen, show bottom confirm bar */}
        {isFullscreen && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="rounded-xl bg-green-600 px-6 py-3 font-bold text-white shadow-lg hover:bg-green-700 transition"
            >
              ✓ Confirm Pinned Location & Close Fullscreen
            </button>
          </div>
        )}
      </div>
    </>
  );
}
