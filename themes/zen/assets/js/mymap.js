function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (angle) => angle * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function getClusterRadius(zoom) {
  var radius = 100;
  switch (zoom) {
    case 14:
      radius = 0.8;
      break;
    case 13:
      radius = 1.6;
      break;
    case 12:
      radius = 2.4;
      break;
    case 11:
      radius = 4;
      break;
    case 10:
      radius = 8;
      break;
    case 9:
      radius = 16;
      break;
    case 8:
      radius = 30;
      break;
    case 7:
      radius = 60;
      break;
    case 6:
      radius = 120;
      break;
    case 5:
      radius = 180;
      break;
    case 4:
      radius = 300;
      break;
    case 3:
      radius = 600;
      break;
    case 2:
      radius = 600;
      break;
    case 1:
      radius = 600;
      break;
  }
  return radius;
}

function getThemeColors() {
  const isDark = localStorage.getItem("pref-theme") === "dark";
  return {
    markerFill: isDark ? "#ff6b6b" : "#ff471a",
    markerStroke: isDark ? "#ffffff" : "#ffffff",
    clusterText: isDark ? "#ff333333" : "#ffffff",
    clusterBorder: isDark ? "#ff000000" : "#ffffff",
    areaFill: isDark ? "#ffd93d" : "#ffcc80",
    areaStroke: isDark ? "#ffd93d" : "#ffcc80"
  };
}

export function aggregateMarkers(amap, input, threshold, colors) {
  const clusters = [];
  const ms = input.map((it) => {
    it._aggregated = false;
    return it;
  });
  ms.forEach((m, index) => {
    let addedToCluster = false;
    if (m._aggregated) return;

    let cluster = [m];
    m._aggregated = true;
    ms.forEach((om, oi) => {
      if (index != oi && !om._aggregated) {
        const position1 = m.getPosition();
        const position2 = om.getPosition();
        const dist = haversine(
          position1.lat,
          position1.lng,
          position2.lat,
          position2.lng,
        );
        if (dist < threshold) {
          cluster.push(om);
          om._aggregated = true;
        }
      }
    });

    if (cluster.length > 1) {
      const position = cluster[0].getPosition();
      const markerCount = cluster.length;

      const clusterMarker = new AMap.Marker({
        position: position,
        content: `<div class="my-cluster-icon" style="width: 32px; height: 32px; background: linear-gradient(135deg, #ffb347, #ff6f61); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: ${colors.clusterText}; font-weight: bold; border: 2px solid ${colors.clusterBorder}; font-size: 14px;">${markerCount}</div>`,
        offset: new AMap.Pixel(-16, -16),
        zIndex: 100
      });
      
      clusterMarker.on("click", function () {
        amap.setZoomAndCenter(amap.getZoom() + 1, clusterMarker.getPosition());
      });
      clusters.push(clusterMarker);
    } else {
      clusters.push(m);
    }
  });
  return clusters;
}

export function init() {
  var defaultTheme = localStorage.getItem("pref-theme") === "dark" ? "amap://styles/dark" : "amap://styles/whitesmoke";
  var map = new AMap.Map("map", {
    zoom: 4,
    center: [117.2345622, 33.3007613],
    zooms: [2, 14],
    viewMode: "3D",
    mapStyle: defaultTheme,
    pitch: 0,
    rotateEnable: false,
    pitchEnable: false
  });

  AMap.plugin(['AMap.Scale', 'AMap.MoveAnimation', 'AMap.ToolBar'], () => {
    var toolbar = new AMap.ToolBar({position: "RT"});
    map.addControl(toolbar);
    var scale = new AMap.Scale({positaion: "LB"});
    map.addControl(scale);
  });

  const aggregationThreshold = 1;

  function createMarkerIcon(colors) {
    const svgTemplate = `
    <div style="position: relative; width: 28px; height: 28px;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="width: 100%; height: 100%;">
        <path fill-opacity=".25" d="M16 32s1.427-9.585 3.761-12.025c4.595-4.805 8.685-.99 8.685-.99s4.044 3.964-.526 8.743C25.514 30.245 16 32 16 32z"/>
        <path stroke="${colors.markerStroke}" fill="${colors.markerFill}" d="M15.938 32S6 17.938 6 11.938C6 .125 15.938 0 15.938 0S26 .125 26 11.875C26 18.062 15.938 32 15.938 32zM16 6a4 4 0 100 8 4 4 0 000-8z"/>
      </svg>
    </div>`;

    return svgTemplate;
  }

  function processGeoJSON(geojson, colors) {
    if (!geojson || !geojson.features) return;
    
    geojson.features.forEach(function(feature) {
      if (!feature.geometry) return;
      
      const geometry = feature.geometry;
      const type = geometry.type;
      const coordinates = geometry.coordinates;
      
      if (type === 'Polygon') {
        const path = coordinates[0].map(function(coord) {
          return new AMap.LngLat(coord[0], coord[1]);
        });
        const polygon = new AMap.Polygon({
          path: path,
          fillColor: colors.areaFill,
          fillOpacity: 0.4,
          strokeColor: colors.areaStroke,
          strokeWeight: 1,
        });
        map.add(polygon);
      } else if (type === 'MultiPolygon') {
        coordinates.forEach(function(polygonCoords) {
          const path = polygonCoords[0].map(function(coord) {
            return new AMap.LngLat(coord[0], coord[1]);
          });
          const polygon = new AMap.Polygon({
            path: path,
            fillColor: colors.areaFill,
            fillOpacity: 0.4,
            strokeColor: colors.areaStroke,
            strokeWeight: 1,
          });
          map.add(polygon);
        });
      }
    });
  }

  var colors = getThemeColors();
  processGeoJSON(areas, colors);

  var markers = points.map((item) => {
    const [popupText, lat, lng] = item;
    const marker = new AMap.Marker({
      position: [lng, lat],
      content: createMarkerIcon(colors),
      offset: new AMap.Pixel(-12, -24),
      zIndex: 50
    });
    marker.setExtData({ popupText: popupText });
    return marker;
  });

  var markerGroup = new AMap.OverlayGroup(aggregateMarkers(map, markers, getClusterRadius(4), colors));
  map.add(markerGroup);

  markers.forEach((marker) => {
    marker.on("click", function() {
      const infoWindow = new AMap.InfoWindow({
        content: marker.getExtData().popupText,
        offset: new AMap.Pixel(0, -30)
      });
      infoWindow.open(map, marker.getPosition());
    });
  });

  map.on("zoomend", function () {
    map.remove(markerGroup);
    const clusters = aggregateMarkers(
      map,
      markers,
      getClusterRadius(map.getZoom()),
      colors
    );
    markerGroup = new AMap.OverlayGroup(clusters);
    map.add(markerGroup);
  });

  function updateTheme() {
    const theme = localStorage.getItem("pref-theme") === "dark" ? "amap://styles/dark" : "amap://styles/whitesmoke";
    map.setMapStyle(theme);
    
    colors = getThemeColors();
    
    markers.forEach((marker) => {
      marker.setContent(createMarkerIcon(colors));
    });
    
    map.remove(markerGroup);
    const clusters = aggregateMarkers(map, markers, getClusterRadius(map.getZoom()), colors);
    markerGroup = new AMap.OverlayGroup(clusters);
    map.add(markerGroup);
  }

  new MutationObserver(() => {
    updateTheme();
  }).observe(document.body, {attributes: true, attributeFilter: ["class"]});

}
