var XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

var CITY_BOUNDS = [
  [-115.403,35.883,-114.790,36.356]
];
var dataURL = 'http://opendata.mybluemix.net/crimes?bbox=' + CITY_BOUNDS[0].toString(); 

var xhttp = new XMLHttpRequest();
xhttp.onreadystatechange = function() {
  if (this.readyState == 4 && this.status == 200) {

    dataBuilder(JSON.parse(this.responseText));
  } else {
    console.log("readyState: " + this.readyState + "  status: " + this.status);
  }
};
xhttp.open("GET", dataURL, true);
xhttp.send();

function dataBuilder(gj) {
  gj.features.forEach(function(feature) {
    // feature.properties.type = type;
    // data.push(feature);
    console.log('===');
    console.log(feature);
  });
}