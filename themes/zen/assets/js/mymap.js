// 足迹地图主逻辑（Mapbox GL JS v3 版本）
// 入口：location_map.html
// 数据：points.js (城市列表) + areas.js (中国省份边界 GeoJSON)
//
// 视觉参考：https://koobai.com/zouguo/
//   - Mapbox Standard 风格派生 + 暖色 config
//   - 缩略图圆点 marker
//   - 屏幕像素距离聚合（不是米距离）
//   - 去过的省份 terracotta 色遮罩
//
// 注意：points.js 和 areas.js 是与本文件 concat 成同一模块的，
//       它们在源文件里就是普通顶层变量（不写 export，也不 import）。
//       见 themes/zen/layouts/partials/location_map.html 的 Concat 流水线。

// ---------- 工具：point-in-polygon ----------

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(lng, lat, feature) {
  if (!feature || !feature.geometry) return false;
  const g = feature.geometry;
  if (g.type === "Polygon") return pointInRing(lng, lat, g.coordinates[0]);
  if (g.type === "MultiPolygon") return g.coordinates.some((poly) => pointInRing(lng, lat, poly[0]));
  return false;
}

// ---------- 工具：解析 points 条目 ----------
// points 的元素：[htmlString, lat, lng]

const POINT_RE =
  /<b>([^<]+)<\/b>\s*<i>([^<]+)<\/i>(?:\s*<a\s+href=['"]([^'"]+)['"]\s*>\s*<img\s+[^>]*src=['"]([^'"]+)['"][^>]*\/?>([^<]*)<\/a>)?/i;

function parsePoint(entry) {
  const [, lat, lng] = entry;
  const html = entry[0] || "";
  const m = html.match(POINT_RE);
  if (!m) return { name: "", en: "", lat, lng, img: "", url: "", title: "" };
  return {
    name: m[1] || "",
    en: m[2] || "",
    url: m[3] || "",
    img: m[4] || "",
    title: (m[5] || "").trim(),
    lat, lng,
  };
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------- 主题 ----------

function isDark() {
  return document.body.classList.contains("dark");
}

// 暖色 Mapbox Standard config（light + dark 两套）
// 参考 koobai 的"足迹 · Footprints Light"：theme=faded, 暖米色调
const WARM_LIGHT = {
  theme: "faded",
  lightPreset: "day",
  colorLand: "hsl(40, 33%, 93%)",
  colorWater: "hsl(192, 31%, 81%)",
  colorRoads: "hsl(37, 19%, 81%)",
  colorTrunks: "hsl(34, 23%, 76%)",
  colorMotorways: "hsl(35, 23%, 72%)",
  colorAdminBoundaries: "hsl(11, 40%, 53%)",
  colorBuildings: "hsl(38, 22%, 83%)",
  colorPlaceLabels: "hsl(34, 6%, 46%)",
  colorRoadLabels: "hsl(32, 6%, 44%)",
  showPointOfInterestLabels: false,
  showRoadLabels: false,
};

const WARM_DARK = {
  theme: "faded",
  lightPreset: "night",
  colorLand: "hsl(35, 15%, 16%)",
  colorWater: "hsl(200, 25%, 20%)",
  colorRoads: "hsl(30, 8%, 28%)",
  colorTrunks: "hsl(28, 12%, 36%)",
  colorMotorways: "hsl(28, 12%, 42%)",
  colorAdminBoundaries: "hsl(15, 30%, 48%)",
  colorBuildings: "hsl(30, 12%, 24%)",
  colorPlaceLabels: "hsl(34, 10%, 72%)",
  colorRoadLabels: "hsl(34, 10%, 60%)",
  showPointOfInterestLabels: false,
  showRoadLabels: false,
};

function getWarmConfig() {
  return isDark() ? WARM_DARK : WARM_LIGHT;
}

function getMarkerColor() {
  return isDark() ? "#c97a63" : "#bd6b55";
}

function getAreaColors() {
  return isDark()
    ? { fill: "#c97a63", fillOpacity: 0.22, stroke: "#d6917b", strokeOpacity: 0.6 }
    : { fill: "#bd6b55", fillOpacity: 0.18, stroke: "#aa6251", strokeOpacity: 0.65 };
}

// ---------- 去过省份 GeoJSON ----------

function getVisitedProvincesFC() {
  const parsed = points.map(parsePoint);
  const features = [];
  for (const f of areas.features) {
    if (f.properties?.level !== "province") continue;
    const hit = parsed.some(
      (p) =>
        typeof p.lat === "number" &&
        typeof p.lng === "number" &&
        pointInFeature(p.lng, p.lat, f)
    );
    if (hit) features.push(f);
  }
  return { type: "FeatureCollection", features };
}

// ---------- 渲染：marker / cluster / popup HTML ----------

function buildMarkerHtml(point, color) {
  const hasImg = !!point.img;
  const cls = "zouguo-marker" + (hasImg ? "" : " is-text-only");
  const style = hasImg
    ? `style="--marker-fill:${escapeAttr(color)};--marker-img:url('${escapeAttr(point.img)}')"`
    : `style="--marker-fill:${escapeAttr(color)}"`;
  return (
    `<div class="${cls}" ${style} role="button" tabindex="0" aria-label="${escapeAttr(point.name)}">` +
    `<div class="zouguo-marker-thumb"></div>` +
    `<div class="zouguo-marker-tail"></div>` +
    `</div>`
  );
}

function buildClusterHtml(members, color) {
  const hasImg = members.filter((m) => m.img);
  const front = hasImg[0] || members[0];
  const back = hasImg[1];
  const count = members.length;

  const frontStyle = front.img
    ? `style="--marker-fill:${escapeAttr(color)};background-image:url('${escapeAttr(front.img)}')"`
    : `style="--marker-fill:${escapeAttr(color)}"`;

  let html = `<div class="zouguo-cluster" role="button" tabindex="0" aria-label="聚合 ${count} 个点，放大查看">`;
  if (back) {
    const backStyle = `style="--marker-fill:${escapeAttr(color)};background-image:url('${escapeAttr(back.img)}')"`;
    html += `<div class="zouguo-cluster-disc is-back" ${backStyle}></div>`;
    html += `<div class="zouguo-cluster-disc is-front" ${frontStyle}></div>`;
  } else {
    const singleStyle = front.img
      ? `style="--marker-fill:${escapeAttr(color)};background-image:url('${escapeAttr(front.img)}')"`
      : `style="--marker-fill:${escapeAttr(color)}"`;
    html += `<div class="zouguo-cluster-disc is-single" ${singleStyle}></div>`;
  }
  if (count > 2) {
    html += `<span class="zouguo-cluster-count">+${count - 2}</span>`;
  }
  html += `</div>`;
  return html;
}

function buildPopupHtml(point, province) {
  const link = point.url
    ? `<a class="zouguo-iw-link" href="${escapeAttr(point.url)}" target="_self">${escapeAttr(point.title || "查看游记")} →</a>`
    : "";
  const eyebrow = province ? `<span class="zouguo-iw-region">${escapeAttr(province)}</span>` : "";
  const imgBlock = point.img
    ? `<div class="zouguo-iw-img" style="background-image:url('${escapeAttr(point.img)}')"></div>`
    : `<div class="zouguo-iw-img is-empty"></div>`;
  return (
    `<div class="zouguo-iw">` +
    `<button class="zouguo-iw-close" type="button" aria-label="关闭">×</button>` +
    imgBlock +
    `<div class="zouguo-iw-body">` +
    eyebrow +
    `<h3 class="zouguo-iw-name">${escapeAttr(point.name)}<i>${escapeAttr(point.en)}</i></h3>` +
    link +
    `</div>` +
    `</div>`
  );
}

// ---------- 聚合：屏幕像素距离 ----------

const CLUSTER_PX = 58;
const ZOOM_NO_CLUSTER = 13.15; // koobai: zoom 超过这个值不再聚合

function clusterLocations(map, locations) {
  const groups = [];
  const assigned = new Array(locations.length).fill(false);

  for (let i = 0; i < locations.length; i++) {
    if (assigned[i]) continue;
    const p1 = map.project([locations[i].lng, locations[i].lat]);
    if (!p1) {
      groups.push([locations[i]]);
      assigned[i] = true;
      continue;
    }
    const group = [locations[i]];
    assigned[i] = true;
    for (let j = i + 1; j < locations.length; j++) {
      if (assigned[j]) continue;
      const p2 = map.project([locations[j].lng, locations[j].lat]);
      if (!p2) continue;
      if (Math.hypot(p2.x - p1.x, p2.y - p1.y) < CLUSTER_PX) {
        group.push(locations[j]);
        assigned[j] = true;
      }
    }
    groups.push(group);
  }
  return groups;
}

// ---------- 主流程 ----------

export function init() {
  const token = window.MAPBOX_TOKEN;
  if (!token || !token.startsWith("pk.")) {
    console.warn(
      "[location-map] Mapbox token 未配置。请设置环境变量 HUGO_PARAMS_MAPBOXTOKEN 后重启 hugo。"
    );
    return;
  }
  if (typeof mapboxgl === "undefined") {
    console.error("[location-map] mapbox-gl 未加载。");
    return;
  }
  mapboxgl.accessToken = token;

  // ---- 地图初始化 ----
  // 中心对准中国（105°E, 35°N 附近），初始 zoom 比之前大，让中国占据屏幕中央
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/standard",
    center: [105, 35],
    zoom: 4.5,
    minZoom: 1.5,
    maxZoom: 18,
    projection: "mercator",
    config: { basemap: getWarmConfig() },
    attributionControl: true,
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
  map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");

  // ---- 解析点 ----
  const locations = points
    .map(parsePoint)
    .filter((p) => typeof p.lat === "number" && typeof p.lng === "number");

  // ---- 省份查找：用于弹窗 eyebrow（用 "lng,lat" 做 key） ----
  const provinceByPoint = new Map();
  for (const f of areas.features) {
    if (f.properties?.level !== "province") continue;
    const provinceName = f.properties.name;
    for (const loc of locations) {
      const key = `${loc.lng.toFixed(4)},${loc.lat.toFixed(4)}`;
      if (provinceByPoint.has(key)) continue;
      if (pointInFeature(loc.lng, loc.lat, f)) {
        provinceByPoint.set(key, provinceName);
      }
    }
  }

  // ---- visited provinces 遮罩 ----
  let provincesReady = false;
  function addVisitedProvinces() {
    if (provincesReady) return;
    const data = getVisitedProvincesFC();
    if (!data.features.length) return;
    const ac = getAreaColors();
    try {
      map.addSource("visited-provinces", { type: "geojson", data });
      map.addLayer({
        id: "visited-provinces-fill",
        type: "fill",
        source: "visited-provinces",
        slot: "bottom",
        paint: {
          "fill-color": ac.fill,
          "fill-opacity": ac.fillOpacity,
          "fill-emissive-strength": 0.12,
        },
      });
      map.addLayer({
        id: "visited-provinces-line",
        type: "line",
        source: "visited-provinces",
        slot: "middle",
        paint: {
          "line-color": ac.stroke,
          "line-width": 1.15,
          "line-opacity": ac.strokeOpacity,
        },
      });
      provincesReady = true;
    } catch (e) {
      // 在 style 还没完全就绪时调 addLayer 会抛错，等 style.load 后再试
      console.warn("[location-map] visited-provinces add failed:", e);
    }
  }

  // ---- 单点 marker + popup ----
  const color = getMarkerColor();
  for (const loc of locations) {
    const el = document.createElement("div");
    el.innerHTML = buildMarkerHtml(loc, color);
    const markerEl = el.firstElementChild;

    const marker = new mapboxgl.Marker({ element: markerEl, anchor: "bottom" })
      .setLngLat([loc.lng, loc.lat])
      .addTo(map);

    const province = provinceByPoint.get(`${loc.lng.toFixed(4)},${loc.lat.toFixed(4)}`) || "";
    const popup = new mapboxgl.Popup({
      offset: 32,
      closeButton: false,
      closeOnClick: false, // 关闭自动关闭，避免 map click 监听器把刚开的弹窗秒关
      maxWidth: "300px",
      className: "zouguo-popup",
    }).setHTML(buildPopupHtml(loc, province));

    markerEl.addEventListener("click", (e) => {
      e.stopPropagation();
      // 切换：再点同一个 marker 关闭弹窗
      const isOpen = popup.isOpen();
      document.querySelectorAll(".mapboxgl-popup").forEach((p) => p.remove());
      if (isOpen) return;
      popup.addTo(map);
      console.log("[location-map] popup opened:", loc.name);
      // 关闭按钮
      const closeBtn = popup.getElement()?.querySelector(".zouguo-iw-close");
      if (closeBtn) {
        closeBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          popup.remove();
        });
      }
    });

    loc.marker = marker;
    loc.markerEl = markerEl;
  }

  // ---- 聚合 ----
  const clusterMarkers = [];

  function clearClusters() {
    for (const cm of clusterMarkers) cm.remove();
    clusterMarkers.length = 0;
  }

  function showAllSingles() {
    for (const loc of locations) {
      if (loc.markerEl) loc.markerEl.style.visibility = "";
    }
  }

  function rebuildClusters() {
    clearClusters();
    if (map.getZoom() >= ZOOM_NO_CLUSTER) {
      showAllSingles();
      return;
    }
    const groups = clusterLocations(map, locations);
    const inCluster = new Set();
    const c = getMarkerColor();

    for (const g of groups) {
      if (g.length === 1) continue;
      const lngSum = g.reduce((s, p) => s + p.lng, 0);
      const latSum = g.reduce((s, p) => s + p.lat, 0);
      const center = [lngSum / g.length, latSum / g.length];

      const el = document.createElement("div");
      el.innerHTML = buildClusterHtml(g, c);
      const clusterEl = el.firstElementChild;

      clusterEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const bounds = new mapboxgl.LngLatBounds();
        for (const m of g) bounds.extend([m.lng, m.lat]);
        map.fitBounds(bounds, { padding: 70, maxZoom: 13.45, duration: 800 });
      });

      const cm = new mapboxgl.Marker({ element: clusterEl, anchor: "center" })
        .setLngLat(center)
        .addTo(map);
      clusterMarkers.push(cm);

      for (const m of g) {
        inCluster.add(m);
        if (m.markerEl) m.markerEl.style.visibility = "hidden";
      }
    }
    for (const loc of locations) {
      if (!inCluster.has(loc) && loc.markerEl) {
        loc.markerEl.style.visibility = "";
      }
    }
  }

  // ---- style.load：重新挂遮罩（应对 setStyle 触发的情况） ----
  map.on("style.load", () => {
    provincesReady = false;
    addVisitedProvinces();
  });

  map.on("load", () => {
    addVisitedProvinces();
    // 保持 [105, 35] / zoom 4.5 的中国中心视图，不做 fitBounds（避免被海外点拉远）
    rebuildClusters();
  });

  map.on("moveend", rebuildClusters);
  map.on("zoomend", rebuildClusters);

  // 点击地图空白处关闭所有弹窗
  map.on("click", () => {
    document.querySelectorAll(".mapboxgl-popup").forEach((p) => p.remove());
  });

  console.log("[location-map] init done. locations:", locations.length, "clusters:", clusterMarkers.length);

  // ---- 主题切换 ----
  const observer = new MutationObserver(() => {
    // 1) basemap config
    const cfg = getWarmConfig();
    for (const k of Object.keys(cfg)) {
      try {
        map.setConfigProperty("basemap", k, cfg[k]);
      } catch {
        /* key 不存在时静默忽略 */
      }
    }
    // 2) 遮罩颜色
    const ac = getAreaColors();
    try {
      if (map.getLayer("visited-provinces-fill")) {
        map.setPaintProperty("visited-provinces-fill", "fill-color", ac.fill);
        map.setPaintProperty("visited-provinces-fill", "fill-opacity", ac.fillOpacity);
      }
      if (map.getLayer("visited-provinces-line")) {
        map.setPaintProperty("visited-provinces-line", "line-color", ac.stroke);
        map.setPaintProperty("visited-provinces-line", "line-opacity", ac.strokeOpacity);
      }
    } catch {
      /* layer 还没就绪，style.load 时会重设 */
    }
    // 3) marker 颜色（只换 CSS 变量，不重建 DOM）
    const mc = getMarkerColor();
    for (const loc of locations) {
      if (loc.markerEl) loc.markerEl.style.setProperty("--marker-fill", mc);
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
