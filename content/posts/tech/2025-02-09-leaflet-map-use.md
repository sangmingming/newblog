---
layout: post
title: 使用Leafletjs实现足迹地图功能
date: 2025-02-09T11:40:56+0800
tags:
  - 折腾
  - 博客
  - 技术
comments: true
feature:
---
我的博客上面挂着一个使用Leaflet实现的足迹地图功能，最近又给他添加了一些功能并且进行了一些美化。之前也有人问题这个怎么实现的，趁着刚折腾完来分享一下。
![](https://img.isming.me/image/myfootmap.jpg)
<!--more-->

### 代码库的选择
早前一直想要做一个足迹的功能，像是国内的百度地图和阿里地图都有js的sdk，但是他们的sdk使用不简单，并且他们的地图只有国内的。后来了解过google map以及mapbox，但是都没有深入研究。后来看到博主水八口记使用了[leaflet](https://leafletjs.com/examples/quick-start/)还比较简单，就使用这个库来实现了我的足迹功能。

### 地图图层
使用leaflet的一大好处是，你可以自由使用你想要的地图图层，对于符合Leaflet的地图瓦片地址我们是可以直接使用的，通常是类似这种格式的地址： `https://{s}.somedomain.com/{foo}/{z}/{x}/{y}.png`，其中的`{z}/{x}/{y}`是必须要支持的，leaflet会在运行的时候替换具体的值，从而请求对应的放大级别（z,zoom）, 对应坐标(x, y)的瓦片进行渲染。

一般使用cartocdn提供的openstreetmap的地图时，是可以直接使用的，但是我们如果想要使用mapbox地图或者其他地图供应商的时候，就需要借助插件了，可以在这个页面看看有没有[Plugins - Leaflet - a JavaScript library for interactive maps](https://leafletjs.com/plugins.html#basemap-providers)。

对于地图图层，leaflet是支持同时加载多个图层的，比如说我可以添加一层底图再添加一层天气卫星图。

我们这里先看一下如何创建一个地图并且设置我们的地图图层.
首先需要引入leaflet的css和js文件
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
<!-- js引入一定要放到css的后面 --> <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
```

之后，在我们需要显示地图的位置放一个div元素，并且设置一个id，这样我们在后面的js代码中才能控制它：
```html
<div id="footprintmap"></div>
```
同时我们可以通过css设置这个容器的宽度高度：
```css
#footprintmap {
width: 100%;
 height: 180px;
}
```

这些做完之后就可以在javascript中去创建地图对象，并且给它添加地图图层了：
```javascript
<script type="text/javascript">

	//地图的版权声明，使用三方地图数据出于对版权的尊重最好加一下
      var cartodbAttribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution" target="_blank">CARTO</a>';
      var map = L.map('map', {gestureHandling: true, minZoom: 1, maxZoom: 14}).setView([33.3007613,117.2345622], 4); //创建地图，设置最大最小放大级别，setView设置地图初始化时候的中心点坐标和放大级别
      map.zoomControl.setPosition('topright'); //设置放大控制按钮的位置
      map.createPane('labels');

      map.getPane('labels').style.zIndex = 650;

      map.getPane('labels').style.pointerEvents = 'none';

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png', {

    attribution: cartodbAttribution

}).addTo(map); //添加地图图层到map对象当中

</script>
```

### 添加足迹点到地图中
经过以上的步骤我们就可以在网页上展示一个地图了，而我们实现足迹功能一般会给我们去过的地点打上标记。一种方法是给去过的城市做一个蒙层，一种方式是加一些点标记。这里先看加点标记的方法。

标记在Leaflet中称为Marker, 我们可以使用以下代码添加默认的Market：
```javascript
marker = new L.marker([33.3007613,117.2345622]).bindPopup("popup text").addTo(map);
```

效果如下:
![](https://img.isming.me/image/leaflet-default-marker.jpg)

在上面我们通过bindPopup来设置点击Marker之后弹出的内容，其中我们是可以设置HTML元素的，因此我们就可以显示图片或者超链接之类的内容了。

如果不喜欢这个默认的蓝色Marker，也可以替换为图片。比如我用如下的代码就设置类一个svg图片作为Market标记图：
```javascript
function colorMarker() {
  const svgTemplate = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="marker">
      <path fill-opacity=".25" d="M16 32s1.427-9.585 3.761-12.025c4.595-4.805 8.685-.99 8.685-.99s4.044 3.964-.526 8.743C25.514 30.245 16 32 16 32z"/>
      <path stroke="#fff" fill="#ff471a" d="M15.938 32S6 17.938 6 11.938C6 .125 15.938 0 15.938 0S26 .125 26 11.875C26 18.062 15.938 32 15.938 32zM16 6a4 4 0 100 8 4 4 0 000-8z"/>
    </svg>`;
  const icon = L.divIcon({
    className: "marker",
    html: svgTemplate,
    iconSize: [28, 28],
    iconAnchor: [12, 24],
    popupAnchor: [7, -16],
  });
  return icon;
}

marker = new L.marker([lat, lng], {
    icon: colorMarker(),
  }).bindPopup(popupText).addTo(map);
```

主要是在前面创建marker的时候传的这个icon,你也可以传普通的图片。

如果我们需要展示多个点的时候，我们可以把这些点的数据存储成一个json，并且把他作为一个JavaScript对象加载，再读取他把每个点添加到地图中。
我就创建了一个`points.js`的文件保存所有的点：
```javascript
let points = [
    ["<b>北京</b><i>Beijing</i><a href='/2025-01-beijing/'><img src='https://img.isming.me/photo/IMG_20250101_133455.jpg' />北京游流水账</a>", 40.190632,116.412144],
    ["<b>广州</b><i>Guangzhou</i>", 23.1220615,113.3714803],];
```
内容大概如上：
```javascript
<!--加载点数据，这样我们在javascript环境中就可以拿到points这个数组-->
 <script type="text/javascript" src="/points.js"></script>
```
以上加载了点数据，通过下面的代码来读取并且添加点：
```javascript
for (let i = 0; i < points.length; i++) {
//循环遍历所有点，并且保存到如下三个变量中
  const [popupText, lat, lng] = points[i];
  marker = new L.marker([lat, lng], {
    icon: colorMarker(),
  }).bindPopup(popupText).addTo(map);
}
```

到此为止就完成了足迹点功能的开发。

### 去过的区域图层开发
而我们要实现去过的城市标记，这个时候就不是一个一个的点了，我们可能给去过的城市添加遮罩，这个其实就是给地图上画一个新的图层。每一个城市本质上就是许多个点围成的多边形，我们可以使用Leaflet提供的`polygon`方法来绘制，但是我们需要给把每个城市的多边形的各个顶点找到并且组织成一个数组，工作量真的是巨大的。

这样的难题我们不是第一个遇到的，前人已经遇到并且帮我们解决了。在2015年就有了GeoJson这种用Json描述的地理空间数据交换格式，他支持描述点，线，多边形。而Leaflet对齐也有支持。因此，我们只需要找到我们所需要的城市的geojson数据的MultiPolygon或者Polygon数据，就可以在Leaflet中进行绘制了。

对于中国的数据，我们可以在阿里云的[datev平台](https://datav.aliyun.com/portal/school/atlas/area_selector)进行下载，你可以省份数据或者按照城市甚至更小的行政单位下载数据。对于国外的数据可以到github上面去查找，这里是一份国家数据: [datasets/geo-countries: Country polygons as GeoJSON in a datapackage](https://github.com/datasets/geo-countries)

对于我们下载的中国的geojson数据，因为比较详细，也就比较大，我们可以使用[mapshaper](https://mapshaper.org/)这个工具来对数据进行一些处理，直接使用Simplify功能，使用它减少点的数量，从而减少我们的文件的大小。

按照geojson文件格式，我们对于多个城市需要组成一个类似如下的json：
```json
{
"type": "FeatureCollection", features: [
{"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [[[88.40590939643968,22.55522906690669],[88.36498482718275,22.494854169816982],[88.28898205570562,22.51497913551355],[88.2714429545955,22.55235407180718],[88.32990662496253,22.55235407180718],[88.36498482718275,22.60410398359836],[88.35913846014606,22.62997893949395],[88.38837029532957,22.62710394439444],[88.40590939643968,22.55522906690669]]]}},
...
]
}
```
对于这样的一个json对象，我们就可以直接使用Leaflet的geojson文件进行加载，代码如下：
```javascript
function onEachFeature(feature, layer) { // does this feature have a property named popupContent? 
	if (feature.properties && feature.properties.popupContent) { 
		layer.bindPopup(feature.properties.popupContent); //从json文件中读取属性进行popup展示
	} 
}

var geojson = L.geoJSON(areas, {
	onEachFeature: onEachFeature,
  style: function (geoJsonFeature) {
    return {
      color: '#ffcc80', //设置遮罩的颜色
      fillOpacity: 0.4, //设置透明度
      stroke: false,   //是否要显示边缘线
    };
  }
}).addTo(map);
```

对于geojson我们也可以在properties中设置弹框的内容进行展示。

### 总结
到这里我们就完成了基于leaflet的一个足迹地图，既包括足迹点，也包括去过的城市的遮罩。而geojson和Leaflet的功能远远不止这些，感兴趣的可以去看相关文档。另外因为我使用的地图是openstreetmap的数据，关于中国领土有争议的部分标记不正确，这个不在我的解决能力只能，只能暂且使用，但是不代表本人观点。

参考资料：
1. [Tutorials - Leaflet - a JavaScript library for interactive maps](https://leafletjs.com/examples.html)
2. [https://tomickigrzegorz.github.io/leaflet-examples/](https://tomickigrzegorz.github.io/leaflet-examples/)
3. [GeoJSON - 维基百科，自由的百科全书](https://zh.wikipedia.org/zh-cn/GeoJSON)
4. [DataV.GeoAtlas地理小工具系列](https://datav.aliyun.com/portal/school/atlas/area_selector)