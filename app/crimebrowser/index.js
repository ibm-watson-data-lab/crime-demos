'use strict';

/* global mapboxgl */
mapboxgl.accessToken = 'pk.eyJ1IjoicmFqcnNpbmdoIiwiYSI6ImpzeDhXbk0ifQ.VeSXCxcobmgfLgJAnsK3nw';//process.env.MapboxAccessToken;

var fs = require('fs');
var path = require('path');
var template = require('lodash.template');
var Raphael = require('raphael');

var wheel = require('./wheel');

// Templates
var listingTemplate = template(fs.readFileSync(path.join(__dirname, '/templates/listing.html'), 'utf8'));
var $svg, lastValue = 0;

// Data
var data = [];
var CITY = 'vegas';
var CITY_BOUNDS = [
  [-115.403,35.883,-114.790,36.356]
];
var CITY_CENTERS = [
  [-115.1427,36.1637]
]
var city_index = 0;
// var dataURL = 'http://opendata.mybluemix.net/crimes?bbox=' + CITY_BOUNDS[city_index].toString(); 
// Layer style
var dataStyle = JSON.parse(fs.readFileSync(path.join(__dirname, '/data/style.json'), 'utf8'));

// var xhttp = new XMLHttpRequest();
// xhttp.onreadystatechange = function() {
//   if (this.readyState == 4 && this.status == 200) {
//     dataBuilder(JSON.parse(this.responseText));
//   } else {
//     loadStatus(this);
//   }
// };
// xhttp.open("GET", dataURL, true);
// xhttp.send();
dataBuilder(JSON.parse(fs.readFileSync(path.join(__dirname, '/data/vegas_crimes.geojson'), 'utf8')), 'art');

function loadStatus(readyState) {
  console.log("readyState: " + readyState.readyState + "  status: " + readyState.status);
}


function dataBuilder(gj) {
  gj.features.forEach(function(feature) {
    feature.properties.crimetype = feature.properties.type;
    feature.properties.type = 'crimes';
    if ( feature.properties.timestamp ) {
      var d = new Date(feature.properties.timestamp);
      feature.properties.time = d.toLocaleString();
    }
    data.push(feature);
  });
}

var pois = ['crimes'];

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/cika7lsg6003p9fm1y5eet742',
  hash: true,
  center:  CITY_CENTERS[city_index],
  zoom: 14,
  maxBounds: CITY_BOUNDS[city_index]
});

// Create a popup, but don't add it to the map yet.
var popup = new mapboxgl.Popup({
  closeButton: false
});

map.scrollZoom.disable();
map.addControl(new mapboxgl.Navigation({
  position: 'top-right'
}));

function addData() {
  map.addSource('geojson', {
    'type': 'geojson',
    'data': {
      'type': 'FeatureCollection',
      'features': data
    }
  });

  dataStyle.forEach(function(style) {
    map.addLayer(style);
  });
}

function buildListings(features) {
  var $listing = document.getElementById('listing');
  $listing.innerHTML = '';
  if (features.length) {
    features.forEach(function(feature) {
      var item = document.createElement('button');
      item.innerHTML = listingTemplate({ data: feature });
      $listing.appendChild(item);

      item.addEventListener('click', function() {
        showPopup(feature);
      });
      item.addEventListener('mouseover', function() {
        showPopup(feature);
      });
      item.addEventListener('mouseout', function() {
        popup.remove();
      });
    });
  } else {
    var emptyState = document.createElement('div');
    emptyState.className = 'pad1 prose';
    emptyState.textContent = document.getElementById('legend').textContent;
    $listing.appendChild(emptyState);
  }
}

function showPopup(feature) {
  popup.setLngLat(feature.geometry.coordinates)
    .setHTML(feature.properties.desc)
    .addTo(map);
}

function getFeatures() {
  var bbox = $svg.getBoundingClientRect();
  var center = {
     x: bbox.left + bbox.width / 2,
     y: bbox.top + bbox.height / 2
  };

  var radius = $svg.getAttribute('width') / 2;
  map.featuresAt({x: center.x, y: center.y}, {
    radius: radius,
    includeGeometry: true,
    layer: pois
  }, function(err, features) {
   if (err || !features.length) {
      popup.remove();
      return;
    }

    buildListings(features);
  });
}

function initialize() {
  var width = map.getContainer().clientWidth;
  var paper = new Raphael(width / 2, 100, 200, 200);
  $svg = paper.canvas;

  var circleStyle = {
    fill: '#027dbd',
    stroke: '#027dbd'
  };

  circleStyle['stroke-width'] = 3;
  circleStyle['fill-opacity'] = 0.1;

  var c = paper.circle(100, 100, 93).attr(circleStyle);

  // Canvas movement shaping
  function start() {
    // Store original coordinates
    this.parentOx = parseInt($svg.style.left, 10);
    this.parentOy = parseInt($svg.style.top, 10);
  }

  function move(dx, dy) {
    var x = this.parentOx + dx;
    var y = this.parentOy + dy;

    $svg.style.left = x;
    $svg.style.top = y;

    getFeatures();
  }

  c.hover(function() {
    document.body.style.cursor = 'move';
  }, function() {
    document.body.style.cursor = 'default';
  });

  c.drag(move, start);

  function zoomStart(e) {
    e.preventDefault();
    var delta = wheel(e, lastValue);
    lastValue = delta;

    var x = parseInt($svg.style.left, 10);
    var y = parseInt($svg.style.top, 10);
    var r = parseInt($svg.getAttribute('width'), 10);
    var radius = r + delta;
    if (radius <= 100) return;

    var left = x + -delta / 2;
    var top = y + -delta / 2;

    $svg.style.left = left;
    $svg.style.top = top;
    $svg.setAttribute('width', radius);
    $svg.setAttribute('height', radius);

    c.attr({
      r: ((radius / 2) - 3),
      cx: (radius / 2),
      cy: (radius / 2)
    });

    // Fetch map data
    getFeatures();
  }

  $svg.addEventListener('wheel', zoomStart, false);
  $svg.addEventListener('mousewheel', zoomStart, false);
}

map.once('source.change', function(ev) {
  if (ev.source.id !== 'geojson') return;

  window.setTimeout(getFeatures, 500);

  // document.getElementById('filter-categories').addEventListener('change', function(e) {
  //   var id = 'poi-' + e.target.id;
  //   var display = (e.target.checked) ? 'visible' : 'none';
  //   map.setLayoutProperty(id, 'visibility', display);
  //   window.setTimeout(getFeatures, 500);
  // });

  document.body.classList.remove('loading');
});

map.on('style.load', addData);
map.on('moveend', getFeatures);

map.on('click', function(e) {
  map.featuresAt(e.point, {
    radius: 7.5,
    includeGeometry: true,
    layer: pois
  }, function(err, features) {
    if (err || !features.length) {
      popup.remove();
      return;
    }

    showPopup(features[0]);
  });
});

map.on('mousemove', function(e) {
  map.featuresAt(e.point, {
    radius: 7.5,
    includeGeometry: true,
    layer: pois
  }, function(err, features) {
    map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';

    if (err || !features.length) {
      popup.remove();
      return;
    }

    showPopup(features[0]);
  });
});

(initialize)();
