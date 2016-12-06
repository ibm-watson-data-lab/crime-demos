'use strict';

// http://opendata.mybluemix.net/crimes?bbox=-115.426,35.883,-114.790,36.407

/* global mapboxgl */
/* eslint-disable new-cap */
mapboxgl.accessToken = 'pk.eyJ1IjoicmFqcnNpbmdoIiwiYSI6ImpzeDhXbk0ifQ.VeSXCxcobmgfLgJAnsK3nw';//process.env.MapboxAccessToken;

// Node modules that browserify supports
// var fs = require('fs');
// var path = require('path');
// var urljoin = require('url-join');
var request = require('browser-request');

var turfSimplify = require('turf-simplify');
var turfWithin = require('turf-within');
var groupBy = require('lodash.groupby');
var removeIt = require('lodash.remove');
var rainbow = require('rainbow');
var Pencil = require('pencil');

// time constraint
var SELECTION_FEATURE = null;
var MIN_TIME = 0;
var MAX_TIME = 24;
var slider = document.getElementById('timeslider');
  // slider stuff
  noUiSlider.create(slider, {
	  start: [0, 24],
    step: 1,
  	connect: true,
	  range: {
		  'min': 0,
		  'max': 24
	  },
    format: {
      to: function(v) { return Math.floor(v)},
      from: function(v) { return Math.floor(v)}
    },
    pips: {
      mode:'steps', 
      filter: function(v, type) {return (v%6 ? 0 : 1);}
    }
  });

  slider.noUiSlider.on('update', function(){
    MIN_TIME = slider.noUiSlider.get()[0];
    MAX_TIME = slider.noUiSlider.get()[1];
    // console.log('min: '+MIN_TIME+'   max: '+MAX_TIME);
    if (SELECTION_FEATURE) {
      redraw(SELECTION_FEATURE);
    }
  }); 
  // end slider stuff

// set the city
var CITIES = ['vegas','boston', 'sf', 'chicago','test'];
var CITIES_NICE_NAME = ['Las Vegas','Boston', 'San Francisco', 'Chicago','Test'];
var CITY_BOUNDS = [
  [-115.2,35.883,-114.790,36.356],
  [-71.192,42.228,-70.985,42.396],
  [-122.525,37.70,-122.348,37.816],
  [-87.876,41.774,-87.587,41.953],
  [-71.073,42.353,-70.973,42.453]
];
var CITY_CENTERS = [
  [-115.1427,36.1637],
  [-71.073,42.353],
  [-122.421,37.781],
  [-87.637,41.897],
  [-71.073,42.353]
];
var CITY = 'vegas';
var city_index = 0;
var qc = getQueryVariable("city");
if (qc && CITIES.indexOf(qc)) {
  city_index = CITIES.indexOf(qc);
  CITY = qc;
  document.getElementById(CITIES[city_index]).selected = true;
}
// console.log("city index: "+city_index);
// console.log("city name: "+CITIES[city_index]);

// Data
// var fn = (CITIES[city_index]+'_crimes.geojson').toString();
// var crimes = JSON.parse(fs.readFileSync(urljoin(__dirname, '../data/', fn)), 'utf8');
var crimes = {};//JSON.parse(fs.readFileSync(urljoin(__dirname, '../data/', 'vegas_crimes.geojson')), 'utf8');

var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v8',
  center: CITY_CENTERS[city_index],
  // maxBounds: CITY_BOUNDS[city_index], 
  zoom: 12.75,
  minZoom: 12
});

if (window.location.search.indexOf('embed') !== -1) map.scrollZoom.disable();

var popup = new mapboxgl.Popup({
  closeButton: false
});

var legend = document.getElementById('legend');
var aggregateContainer = document.getElementById('aggregates');
var defaultText = document.createElement('strong');

aggregateContainer.appendChild(defaultText);

var drawControls = document.getElementById('draw-controls');
var drawCanvas = document.getElementById('canvas');
var draw, clearSelection;

var pencil = new Pencil(drawCanvas);

// Colorized circles to represent crimes
// [<cooresponding diameter>, <color>]
var layers = [
  ["CDSSTREET", '#FF0000', 6, 'Street crime'],
  ["CDSNV", '#0000FF', 4, 'Non-Violent'],
  ["CDSDV", '#00FF00', 5, 'Domestic']
];

function initialize() {
  document.body.classList.remove('loading');

  document.getElementById('citynameintitle').textContent = CITIES_NICE_NAME[city_index];
  defaultText.textContent = crimes.features.length.toLocaleString() + ' total crimes';

  map.addSource('crimes', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  map.addSource('geojson', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: []
    }
  });

  // Polygon style
  map.addLayer({
    id: 'polygon-query-fill',
    type: 'fill',
    source: 'geojson',
    paint: {
      'fill-color': '#027dbd',
      'fill-opacity': 0.05
    }
  }, 'place_label_neighborhood');

  map.addLayer({
    id: 'polygon-query-line',
    type: 'line',
    source: 'geojson',
    paint: {
      'line-color': '#027dbd',
      'line-join': 'round',
      'line-width': 2
    }
  }, 'place_label_neighborhood');

  // Crime markers
  layers.forEach(function(layer, i) {
    map.addLayer({
      id: 'crime-markers-' + i,
      type: 'circle',
      source: 'crimes',
      interactive: true,
      paint: {
        'circle-color': layer[1],
        'circle-radius': layer[2],
        'circle-opacity': 0.75
      },
      filter: ['==', layer[0], true]
    }, 'place_label_neighborhood');
  });

  // Set the draw canvas to the same width+height as the map.
  drawCanvas.setAttribute('width', map.getCanvas().offsetWidth);
  drawCanvas.setAttribute('height', map.getCanvas().offsetHeight);

  // Add the draw control to the map
  draw = document.createElement('button');
  draw.id = 'draw';
  draw.className = 'icon pencil button round-right draw-ctrl';
  draw.title = 'Draw';

  draw.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    if (draw.classList.contains('active')) {
      disableDraw();
    } else {
      draw.classList.add('active');
      drawCanvas.classList.remove('hidden');
      drawCanvas.style.cursor = 'crosshair';
      pencil.enable();
    }
  });

  drawControls.appendChild(draw);

  pencil.on('result', function(e) {
    var feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[]]
      }
    };

    e.result.forEach(function(res) {
      var coords = map.unproject(res);
      feature.geometry.coordinates[0].push([coords.lng, coords.lat]);
    });

    // Push the first entry to complete the shape
    feature.geometry.coordinates[0].push(feature.geometry.coordinates[0][0]);

    // Simplify the feature.
    feature = turfSimplify(feature, 0.0001, true);
    SELECTION_FEATURE = feature;
    redraw(feature);

    // Clear the draw canvas
    disableDraw();
  });

  buildLegend();
}

function redraw(feature) {
  var geojson = {
    type: 'FeatureCollection',
    features: feature ? [feature] : []
  };

  // Grab all the features and draw them as polygons on the map
  map.getSource('geojson').setData(geojson);

  // Is there crime data within the drawn features?
  var within = feature ? turfWithin(crimes, geojson) : geojson;

  // console.log('start length: '+within.features.length);
  removeIt(within.features, function(d){
    var t = new Date(d.properties.timestamp);
    // console.log("time: " + t.toUTCString() + "     hours: "+t.getUTCHours());
    return (t.getUTCHours()<MIN_TIME || t.getUTCHours()>MAX_TIME);
  });
  // console.log('end length: '+within.features.length);

  // Add to map
  map.getSource('crimes').setData(within);

  // Build aggregation
  aggregateContainer.innerHTML = '';
  if (within.features.length) {
    var count = document.createElement('strong');
    count.className = 'block space-bottom1';
    count.textContent = within.features.length.toLocaleString() + ' crimes selected';
    aggregateContainer.appendChild(count);

    var aggregates = [{
      label: 'Crime class',
      aggregate: groupBy(within.features, function(d) {
        if (d.properties.CDSDV == true) { return "Domestic Violence"; }  
        else if (d.properties.CDSNV == true) { return "Non-Violent"; }
        else if (d.properties.CDSSTREET == true) { return "STREET CRIME"; }
        return "UNKNOWN";
      })
    }, {
      label: 'Jurisdictional classification',
      aggregate: groupBy(within.features, function(d) {
        if (d.properties.desc) return d.properties.desc;
        return "UNKNOWN";
      })
    }];

    var index = 0;
    aggregates.forEach(function(d) {
      var label = document.createElement('strong');
      label.className = 'block space-bottom0 quiet small strong';
      label.textContent = d.label;
      // aggregateContainer.appendChild(label);

      var barContainer = document.createElement('div');
      barContainer.className = 'clearfix col12 space-bottom1 dark contain';

      var propindex = 0;
      for (var prop in d.aggregate) {
        try {
          var bar = document.createElement('div');
          bar.className = 'fl bar fill-blue pad0y';

          var percentage = (d.aggregate[prop].length / within.features.length) * 100;
          percentage = percentage < 1 ? percentage.toFixed(1) : Math.floor(percentage);

          bar.style.width = percentage + '%';
          if (index==0 && propindex<=layers.length) bar.style.backgroundColor = layers[propindex][1];
          else bar.style.backgroundColor = '#'+Math.floor(Math.random()*16777215).toString(16);
          
          
          var tooltip = prop + ' (' + percentage + '%)';
          bar.setAttribute('data-tooltip', tooltip.toLowerCase());
          barContainer.appendChild(bar);
        } catch(e) {
          console.log(e.stack);
          console.log("PROP: "+prop);
          console.log("d.aggregate[prop]: "+d.aggregate[prop]);
        } finally {
          propindex++;
        }
      }
      index++;

      aggregateContainer.appendChild(barContainer);
      aggregateContainer.appendChild(label);
      aggregateContainer.appendChild(document.createElement('p'));
    });
  } else {
    aggregateContainer.appendChild(defaultText);
  }

  if (feature && !clearSelection) {
    // Add remove selection link
    clearSelection = document.createElement('button');
    clearSelection.className = 'dark button round-left pad2x draw-ctrl keyline-right';
    clearSelection.textContent = 'Clear selection';
    clearSelection.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      redraw();
    });
    drawControls.insertBefore(clearSelection, draw);
  }

  if (!feature && clearSelection) {
    drawControls.removeChild(clearSelection);
    clearSelection = null;
  }

  legend.classList.toggle('hidden', !feature);
}

function disableDraw() {
  if (!draw) return;
  draw.classList.remove('active');
  drawCanvas.classList.add('hidden');
  drawCanvas.style.cursor = '';
  pencil.disable().clear();
}

function buildLegend() {
  var title = document.createElement('h4');
  title.className = 'block space-bottom0';
  title.textContent = 'Crime type';
  var list = document.createElement('div');
  var listul = document.createElement('ul');
  list.appendChild(listul);

  layers.forEach(function(layer, i) {
    var litem = document.createElement('li');
    var item = document.createElement('span');
    item.className = 'inline dot';
    // if (i !== 0) item.classList.add('space-left0');
    item.style.backgroundColor = layer[1];
    item.style.width = '12px';//layer[2] * 2 + 'px';
    item.style.height = '12px';//layer[2] * 2 + 'px';
    litem.appendChild(item);
    var itemtext = document.createElement('span');
    itemtext.textContent = ' '+layer[3];
    litem.appendChild(itemtext);
    listul.appendChild(litem);
  });

  // var key = document.createElement('div');
  // key.className = 'mobile-cols clearfix micro';

  // var start = document.createElement('div');
  // start.className = 'col6';
  // start.textContent = layers[0][0];
  // key.appendChild(start);

  // var end = document.createElement('div');
  // end.className = 'col6 text-right';
  // end.textContent = layers[layers.length - 1][0];
  // key.appendChild(end);

  legend.appendChild(title);
  legend.appendChild(list);
  // legend.appendChild(key);
}

map.on('mousemove', function(e) {
  map.featuresAt(e.point, {
    radius: 2.5, // Half the marker size (5px).
    includeGeometry: true,
    layer: layers.map(function(layer, i) {
      return 'crime-markers-' + i;
    })
  }, function(err, features) {
    // Change the cursor style as a UI indicator.
    map.getCanvas().style.cursor = (!err && features.length) ? 'pointer' : '';

    if (err || !features.length) {
      popup.remove();
      return;
    }

    // var feature = features[0];
    // var p = feature.properties;
    // var popupContainer = document.createElement('div');

    // Look up species code for proper name
    // codes.forEach(function(code) {
    //   p.species = p.species === code.code ? code.name : p.species;
    // });

    // Look up condition for description
    // conditions.forEach(function(condition) {
    //   p.condition = p.condition === condition.code ? condition.description : p.condition;
    // });

    // [
    //   ['Species', p.species.toLowerCase()],
    //   ['Condition', p.condition],
    //   ['Diameter', p.diameter + 'in']
    // ].forEach(function(d) {
    //   var item = document.createElement('div');
    //   var label = document.createElement('strong');
    //   label.className = 'space-right0';
    //   label.textContent = d[0];

    //   var value = document.createElement('div');
    //   value.className = 'inline capitalize';
    //   value.textContent = d[1];

    //   item.appendChild(label);
    //   item.appendChild(value);
    //   popupContainer.appendChild(item);
    // });

    // Initialize a popup and set its coordinates
    // based on the feature found.
    // popup.setLngLat(feature.geometry.coordinates)
    //   .setHTML(popupContainer.innerHTML)
    //   .addTo(map);
  });
});

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] == variable) { return pair[1]; }
  }
  return (false);
}

function getCrimeData() {
  var dataurl = 'http://opendata.mybluemix.net/crimes?bbox=' + CITY_BOUNDS[city_index].toString();
  // dataurl = '/data/boston_crimes.geojson';
  request.get({url:dataurl, json:true}, function(er, resp, result) {
    if(er)
      throw er;

    crimes = resp.body;
    initialize();
  });
}

map.on('load', getCrimeData);