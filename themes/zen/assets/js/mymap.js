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

export function aggregateMarkers(leafletMap, input, threshold) {
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
        const dist = haversine(
          m.getPosition().lat,
          m.getPosition().lng,
          om.getPosition().lat,
          om.getPosition().lng,
        );
        if (dist < threshold) {
          cluster.push(om);
          om._aggregated = true;
        }
      }
    });

    if (cluster.length > 1) {
      const llg = new AMap.LngLat(
        cluster[0].getPosition().lng,
        cluster[0].getPosition().lat,
      );
      const markerCount = cluster.length;

      const clusterMarker = new AMap.Marker({
        position: llg,
        content: `<div class="my-cluster-icon" style="width: 32px; height: 32px; background: #ff471a; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid white;">${markerCount}</div>`,
        offset: new AMap.Pixel(-16, -16),
      });
      
      clusterMarker.on("click", function () {
        leafletMap.setZoomAndCenter(leafletMap.getZoom() + 1, clusterMarker.getPosition());
      });
      clusters.push(clusterMarker);
    } else {
      clusters.push(m);
    }
  });
  return clusters;
}

export function init() {
  var map = new AMap.Map("map", {
    zoom: 4,
    center: [117.2345622, 33.3007613],
    zooms: [2, 14],
    viewMode: "2D",
    mapStyle: "amap://styles/whitesmoke",
  });

  map.addControl(new AMap.ControlBar({
    position: {
      top: '10px',
      right: '10px'
    }
  }));

  const aggregationThreshold = 1;

  function createMarkerIcon() {
    const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="marker" style="width: 28px; height: 28px;">
      <path fill-opacity=".25" d="M16 32s1.427-9.585 3.761-12.025c4.595-4.805 8.685-.99 8.685-.99s4.044 3.964-.526 8.743C25.514 30.245 16 32 16 32z"/>
      <path stroke="#fff" fill="#ff471a" d="M15.938 32S6 17.938 6 11.938C6 .125 15.938 0 15.938 0S26 .125 26 11.875C26 18.062 15.938 32 15.938 32zM16 6a4 4 0 100 8 4 4 0 000-8z"/>
    </svg>`;

    return svgTemplate;
  }

  var geojson = new AMap.GeoJSON({
    geoJSON: areas,
    getMarker: function(geojson, lnglats) {
      return null;
    },
    getPolyline: function(geojson, lnglats) {
      return null;
    },
    getPolygon: function(geojson, lnglats) {
      return new AMap.Polygon({
        path: lnglats,
        fillColor: "#ffcc80",
        fillOpacity: 0.4,
        strokeColor: "#ffcc80",
        strokeWeight: 1,
      });
    }
  });
  map.add(geojson);

  var markers = points.map((item) => {
    const [popupText, lat, lng] = item;
    return new AMap.Marker({
      position: [lng, lat],
      content: createMarkerIcon(),
      offset: new AMap.Pixel(-12, -24),
      extData: { popupText: popupText }
    });
  });

  var markerGroup = new AMap.OverlayGroup(aggregateMarkers(map, markers, getClusterRadius(4)));
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
    );
    markerGroup = new AMap.OverlayGroup(clusters);
    map.add(markerGroup);
  });
}
