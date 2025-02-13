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

function getClusterRadius(zoom) {
  var radius = 100;
  switch (zoom) {
    case 14:
      radius = 1;
      break;
    case 13:
      radius = 2;
      break;
    case 12:
      radius = 3;
      break;
    case 11:
      radius = 5;
      break;
    case 10:
      radius = 9;
      break;
    case 9:
      radius = 20;
      break;
    case 8:
      radius = 40;
      break;
    case 7:
      radius = 70;
      break;
    case 6:
      radius = 180;
      break;
    case 5:
      radius = 290;
      break;
    case 4:
      radius = 400;
      break;
    case 3:
      radius = 900;
      break;
    case 2:
      radius = 1800;
      break;
    case 1:
      radius = 1800;
      break;
  }
  return radius;
}

function aggregateMarkers(leafletMap, input, threshold) {
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
      const latLng = L.latLng(
        cluster[0].getLatLng().lat,
        cluster[0].getLatLng().lng,
      );
      const markerCount = cluster.length;

      const clusterMarker = L.marker(latLng, {
        icon: L.divIcon({
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
