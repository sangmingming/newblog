// 足迹地图主逻辑
// 入口：location_map.html
// 数据：points.js (城市列表) + areas.js (中国省份边界 GeoJSON)
//
// 主要能力：
//  1. 去过的省份高亮遮罩（terracotta 色，参考 koobai.com/zouguo/）
//  2. 缩略图圆点 marker（无图时退化为小圆点）
//  3. 屏幕像素距离聚合（不是米距离）+ 双 disc 缩略图 cluster
//  4. InfoWindow 卡片：缩略图 + 中英文名 + 关联文章链接

import { points } from "./points.js";
import { areas } from "./areas.js";

// ---------- 工具：point-in-polygon ----------

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(lng, lat, feature) {
  if (!feature || !feature.geometry) return false;
  const g = feature.geometry;
  if (g.type === "Polygon") {
    return pointInRing(lng, lat, g.coordinates[0]);
  }
  if (g.type === "MultiPolygon") {
    return g.coordinates.some((poly) => pointInRing(lng, lat, poly[0]));
  }
  return false;
}

// ---------- 工具：解析 points 条目 ----------
// points 的元素：[htmlString, lat, lng]
// htmlString 形如：<b>北京</b><i>Beijing</i><a href='url'><img src='...' />标题</a>

const POINT_RE =
  /<b>([^<]+)<\/b>\s*<i>([^<]+)<\/i>(?:\s*<a\s+href=['"]([^'"]+)['"]\s*>\s*<img\s+[^>]*src=['"]([^'"]+)['"][^>]*\/?>([^<]*)<\/a>)?/i;

function parsePoint(entry) {
  const [, lat, lng] = entry;
  const html = entry[0] || "";
  const m = html.match(POINT_RE);
  if (!m) {
    return { name: "", en: "", lat, lng, img: "", url: "", title: "" };
  }
  return {
    name: m[1] || "",
    en: m[2] || "",
    url: m[3] || "",
    img: m[4] || "",
    title: (m[5] || "").trim(),
    lat,
    lng,
  };
}

// ---------- 工具：主题色 ----------

function isDark() {
  return document.body.classList.contains("dark");
}

function getTheme() {
  return isDark() ? "amap://styles/dark" : "amap://styles/whitesmoke";
}

function getMarkerColor() {
  return isDark() ? "#c97a63" : "#bd6b55";
}

function getAreaColors() {
  return isDark()
    ? { fill: "#c97a63", fillOpacity: 0.22, stroke: "#d6917b", strokeOpacity: 0.6, strokeWeight: 1 }
    : { fill: "#bd6b55", fillOpacity: 0.18, stroke: "#aa6251", strokeOpacity: 0.65, strokeWeight: 1 };
}

// ---------- 工具：去过的省份 ----------

function getVisitedProvinceAdcodes() {
  const parsed = points.map(parsePoint);
  const visited = new Set();
  for (const p of parsed) {
    if (typeof p.lat !== "number" || typeof p.lng !== "number") continue;
    for (const f of areas.features) {
      if (f.properties?.level !== "province") continue;
      if (pointInFeature(p.lng, p.lat, f)) {
        if (f.properties.adcode) visited.add(f.properties.adcode);
      }
    }
  }
  return visited;
}

// ---------- 渲染：marker 元素 ----------

function escapeAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildMarkerContent(point, color) {
  const hasImg = !!point.img;
  const cls = "zouguo-marker" + (hasImg ? "" : " is-text-only");
  // 内联 background-image，避免 AMap 二次解析 <style>
  const style = hasImg
    ? `style="--marker-fill:${escapeAttr(color)};--marker-img:url('${escapeAttr(point.img)}')"`
    : `style="--marker-fill:${escapeAttr(color)}"`;
  return `<div class="${cls}" ${style} role="button" tabindex="0" aria-label="${escapeAttr(point.name)}">` +
    `<div class="zouguo-marker-thumb"></div>` +
    `<div class="zouguo-marker-tail"></div>` +
    `</div>`;
}

// ---------- 渲染：聚合 ----------

function buildClusterContent(members, color) {
  const hasImgMembers = members.filter((m) => m.img);
  const front = hasImgMembers[0] || members[0];
  const back = hasImgMembers[1];
  const count = members.length;

  const discFrontStyle = front.img
    ? `style="--marker-fill:${escapeAttr(color)};background-image:url('${escapeAttr(front.img)}')"`
    : `style="--marker-fill:${escapeAttr(color)}"`;

  let html = `<div class="zouguo-cluster" role="button" tabindex="0" aria-label="聚合 ${count} 个点，放大查看">`;
  if (back) {
    const backStyle = `style="--marker-fill:${escapeAttr(color)};background-image:url('${escapeAttr(back.img)}')"`;
    html += `<div class="zouguo-cluster-disc is-back" ${backStyle}></div>`;
    html += `<div class="zouguo-cluster-disc is-front" ${discFrontStyle}></div>`;
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

// ---------- 渲染：InfoWindow 卡片 ----------

function buildInfoHtml(point) {
  const imgStyle = point.img
    ? `style="background-image:url('${escapeAttr(point.img)}')"`
    : "";
  const link = point.url
    ? `<a class="zouguo-iw-link" href="${escapeAttr(point.url)}" target="_self">${point.title || "查看游记 →"}</a>`
    : "";
  return (
    `<div class="zouguo-iw">` +
    (point.img ? `<span class="zouguo-iw-img" ${imgStyle}></span>` : "") +
    `<div class="zouguo-iw-body">` +
    `<p class="zouguo-iw-name">${escapeAttr(point.name)}<i class="zouguo-iw-en">${escapeAttr(point.en)}</i></p>` +
    link +
    `</div>` +
    `</div>`
  );
}

// ---------- 聚合：屏幕像素距离 ----------

const CLUSTER_PX = 50;

function projectToContainer(amap, marker) {
  // AMap v2: lngLatToContainer 返回相对于地图容器的像素坐标
  try {
    return amap.lngLatToContainer(marker.getPosition());
  } catch {
    const p = marker.getPosition();
    return amap.lngLatToPixel(p, amap.getZoom());
  }
}

function clusterMarkers(amap, markers) {
  // 简单贪心：未分配的点开一个新组，把所有 50px 内的点吸进来
  const groups = [];
  const items = markers.map((m) => ({ marker: m, point: m.getExtData().point }));
  const assigned = new Array(items.length).fill(false);

  for (let i = 0; i < items.length; i++) {
    if (assigned[i]) continue;
    const center = projectToContainer(amap, items[i].marker);
    if (!center) {
      // 容器还没就绪：作为单点处理
      groups.push([items[i]]);
      assigned[i] = true;
      continue;
    }
    const group = [items[i]];
    assigned[i] = true;
    for (let j = i + 1; j < items.length; j++) {
      if (assigned[j]) continue;
      const c2 = projectToContainer(amap, items[j].marker);
      if (!c2) continue;
      const dx = c2.x - center.x;
      const dy = c2.y - center.y;
      if (Math.hypot(dx, dy) < CLUSTER_PX) {
        group.push(items[j]);
        assigned[j] = true;
      }
    }
    groups.push(group);
  }
  return groups;
}

// ---------- 主流程 ----------

export function init() {
  const map = new AMap.Map("map", {
    zoom: 4,
    center: [108, 34],
    zooms: [2, 18],
    viewMode: "2D",
    mapStyle: getTheme(),
    pitch: 0,
    rotateEnable: true,
    pitchEnable: false,
  });

  AMap.plugin(["AMap.Scale", "AMap.MoveAnimation", "AMap.ToolBar"], () => {
    map.addControl(new AMap.ToolBar({ position: "RT" }));
    map.addControl(new AMap.Scale());
  });

  // ---------- 遮罩：只画去过的省份 ----------
  const areaColors = getAreaColors();
  const visitedAdcodes = getVisitedProvinceAdcodes();
  const visitedPolygons = [];
  for (const f of areas.features) {
    if (f.properties?.level !== "province") continue;
    if (!visitedAdcodes.has(f.properties.adcode)) continue;
    const g = f.geometry;
    if (g.type === "Polygon") {
      visitedPolygons.push(g.coordinates[0].map(([lng, lat]) => [lng, lat]));
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates) {
        visitedPolygons.push(poly[0].map(([lng, lat]) => [lng, lat]));
      }
    }
  }
  for (const path of visitedPolygons) {
    const ring = path.map(([lng, lat]) => new AMap.LngLat(lng, lat));
    map.add(
      new AMap.Polygon({
        path: ring,
        fillColor: areaColors.fill,
        fillOpacity: areaColors.fillOpacity,
        strokeColor: areaColors.stroke,
        strokeWeight: areaColors.strokeWeight,
        strokeOpacity: areaColors.strokeOpacity,
      })
    );
  }

  // ---------- marker：每个点一个 ----------
  const color = getMarkerColor();
  const markers = points.map((entry) => {
    const p = parsePoint(entry);
    const m = new AMap.Marker({
      position: [p.lng, p.lat],
      content: buildMarkerContent(p, color),
      offset: new AMap.Pixel(-19, -46),
      zIndex: 50,
      extData: { point: p, raw: entry },
    });
    return m;
  });

  let markerGroup = null;

  function rebuildGroup() {
    if (markerGroup) {
      map.remove(markerGroup);
      markerGroup = null;
    }
    const groups = clusterMarkers(map, markers);
    const overlays = [];
    for (const g of groups) {
      if (g.length === 1) {
        overlays.push(g[0].marker);
        continue;
      }
      const pointsInCluster = g.map((x) => x.point);
      const lngSum = pointsInCluster.reduce((s, p) => s + p.lng, 0);
      const latSum = pointsInCluster.reduce((s, p) => s + p.lat, 0);
      const center = new AMap.LngLat(lngSum / g.length, latSum / g.length);
      const clusterMarker = new AMap.Marker({
        position: center,
        content: buildClusterContent(pointsInCluster, color),
        offset: new AMap.Pixel(-28, -28),
        zIndex: 100,
        extData: { cluster: true, members: g.map((x) => x.marker) },
      });
      clusterMarker.on("click", () => {
        fitToCluster(g.map((x) => x.marker));
      });
      overlays.push(clusterMarker);
    }
    markerGroup = new AMap.OverlayGroup(overlays);
    map.add(markerGroup);
  }

  function fitToCluster(ms) {
    if (!ms.length) return;
    const bounds = new AMap.Bounds(ms[0].getPosition(), ms[0].getPosition());
    for (let i = 1; i < ms.length; i++) bounds.extend(ms[i].getPosition());
    map.setBounds(bounds, false, [60, 60, 60, 60]);
  }

  rebuildGroup();

  // ---------- 单点点击 → InfoWindow ----------
  const infoWindow = new AMap.InfoWindow({
    offset: new AMap.Pixel(0, -42),
    closeWhenClickMap: true,
    autoMove: true,
    isCustom: false,
  });
  for (const m of markers) {
    m.on("click", () => {
      const p = m.getExtData().point;
      infoWindow.setContent(buildInfoHtml(p));
      infoWindow.open(map, m.getPosition());
    });
  }

  // ---------- 视野变化时重新聚合 ----------
  map.on("moveend", rebuildGroup);
  map.on("zoomend", rebuildGroup);

  // ---------- 主题切换 ----------
  const observer = new MutationObserver(() => {
    const t = getTheme();
    map.setMapStyle(t);
    const c = getMarkerColor();
    // 重建 marker 内容以更新颜色
    for (const m of markers) {
      m.setContent(buildMarkerContent(m.getExtData().point, c));
    }
    rebuildGroup();
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
