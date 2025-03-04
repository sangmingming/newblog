//import { points } from "/points.js";
//import { areas } from "/areas.js";
//import {map as createMap, tileLayer, divIcon, geoJSON, layerGroup, latLng, marker, } from "/js/leaflet-1.9.4.esm.js";

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径 (km)
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
          m.getLatLng().lat,
          m.getLatLng().lng,
          om.getLatLng().lat,
          om.getLatLng().lng,
        );
        if (dist < threshold) {
          cluster.push(om);
          om._aggregated = true;
        }
      }
    });

    if (cluster.length > 1) {
      const llg = toLatLng(
        cluster[0].getLatLng().lat,
        cluster[0].getLatLng().lng,
      );
      const markerCount = cluster.length;

      const clusterMarker = marker(llg, {
        icon: divIcon({
          className: "my-cluster-icon",
          html: `<b>${markerCount}</b>`,
          iconSize: [32, 32],
        }),
      });
      clusterMarker.on("click", function () {
        leafletMap.flyTo(clusterMarker.getLatLng(), leafletMap.getZoom() + 1);
        //leafletMap.zoomIn();
      });
      clusters.push(clusterMarker);
    } else {
      clusters.push(m);
    }
  });
  return clusters;
}

export function init() {
  var cartodbAttribution =
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution" target="_blank">CARTO</a>';
    var map = createMap("map", {
        gestureHandling: true,
        minZoom: 2,
        maxZoom: 14,
    }).setView([33.3007613, 117.2345622], 4);
    map.zoomControl.setPosition("topright");
    map.createPane("labels");
    map.getPane("labels").style.zIndex = 650;
    map.getPane("labels").style.pointerEvents = "none";
    tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png",
        {
            attribution: cartodbAttribution,
        },
    ).addTo(map);

    const aggregationThreshold = 1; //1km

    function colorMarker() {
        const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="marker">
      <path fill-opacity=".25" d="M16 32s1.427-9.585 3.761-12.025c4.595-4.805 8.685-.99 8.685-.99s4.044 3.964-.526 8.743C25.514 30.245 16 32 16 32z"/>
      <path stroke="#fff" fill="#ff471a" d="M15.938 32S6 17.938 6 11.938C6 .125 15.938 0 15.938 0S26 .125 26 11.875C26 18.062 15.938 32 15.938 32zM16 6a4 4 0 100 8 4 4 0 000-8z"/>
    </svg>`;

        const icon = divIcon({
            className: "marker",
            html: svgTemplate,
            iconSize: [28, 28],
            iconAnchor: [12, 24],
            popupAnchor: [7, -16],
        });

        return icon;
    }

    // L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png', {
    //   attribution: cartodbAttribution,
    //   pane: 'labels'
    // }).addTo(map);
    var geojson = geoJSON(areas, {
        style: function (geoJsonFeature) {
            return {
                color: "#ffcc80",
                fillOpacity: 0.4,
                stroke: false,
            };
        },
    }).addTo(map);

    var markers = points.map((item) => {
        const [popupText, lat, lng] = item;
        return new marker([lat, lng], {
            icon: colorMarker(),
        }).bindPopup(popupText);
    });

    var marketGrop = layerGroup(
        aggregateMarkers(map, markers, getClusterRadius(4)),
    ).addTo(map);

    map.on("zoomend", function () {
        marketGrop.clearLayers();
        const clusters = aggregateMarkers(
            map,
            markers,
            getClusterRadius(map.getZoom()),
        );
        clusters.forEach((cluster) => {
            marketGrop.addLayer(cluster);
        });
    });
}