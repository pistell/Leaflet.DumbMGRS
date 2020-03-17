import './styles.scss';
// Import the default marker icons from leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  L, map, generateGZDGrids, generate100kGrids, generate1000meterGrids, LLtoUTM, UTMtoMGRS,
} from './L.DumbMGRS';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';


// *********************************************************************************** //
// * Enable default images in the marker (for example page)                          * //
// *********************************************************************************** //
// https://github.com/Leaflet/Leaflet/issues/4968#issuecomment-264311098
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  // icon is 25x41 pixels, so adjust anchor point
  iconAnchor: [12.5, 41],
  popupAnchor: [0, -41],
});

// Set the default marker icon to the constants provided above
L.Marker.prototype.options.icon = DefaultIcon;


// *********************************************************************************** //
// * Add the Leaflet map to the page                                                 * //
// *********************************************************************************** //
L.tileLayer('https://c.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  id: 'osm_map',
}).addTo(map);

//! Draw
function clearResults() {
  const resultsContentArea = document.getElementById('resultsContentArea');
  resultsContentArea.value = '';
  map.eachLayer((layer) => {
    if (!(layer instanceof L.TileLayer)) {
      map.removeLayer(layer);
    }
  });
}


const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems,

  },
});

map.addControl(drawControl);

map.on('draw:created', (e) => {
  const { layer } = e;
  drawnItems.addLayer(layer);
});

map.on('draw:started', () => {
  clearResults();
});

//! Control
// const myTextLabel = L.marker(map.getCenter(), {
//   interactive: true,
//   icon: L.divIcon({
//     className: 'text-labels', // Set class for CSS styling
//     html: `<svg xmlns="http://www.w3.org/2000/svg" height="100%" width="100%" viewBox="0 0 3 3">
//     <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle">TEST</text>
//     </svg>`,
//   }),
//   zIndexOffset: 1000, // Make appear above other map features
// });
// myTextLabel.addTo(map);

// *********************************************************************************** //
// * Leaflet.DumbMGRS - Add plugins to the map                                       * //
// *********************************************************************************** //
generateGZDGrids.addTo(map);
generate100kGrids.addTo(map);
generate1000meterGrids.addTo(map);

// *********************************************************************************** //
// * Helper functions (for debugging)                                                * //
// *********************************************************************************** //
// Just a quicker way to add a marker, used for debugging purposes
function mark(element) {
  const marker = new L.marker(element);
  const markerLat = marker.getLatLng().lat;
  const markerLng = marker.getLatLng().lng;
  const markerNorthing = LLtoUTM({ lat: markerLat, lon: markerLng }).northing;
  const markerEasting = LLtoUTM({ lat: markerLat, lon: markerLng }).easting;
  const markerZoneLetter = LLtoUTM({ lat: markerLat, lon: markerLng }).zoneLetter;
  const markerZoneNumber = LLtoUTM({ lat: markerLat, lon: markerLng }).zoneNumber;
  const popupContent = `<h3><u>Lat:</u> ${markerLat.toFixed(6)} <u>Lng:</u> ${markerLng.toFixed(6)}</h3>
                        <h3><u>Northing:</u> ${markerNorthing}</h3>
                        <h3><u>Easting:</u> ${markerEasting}</h3>
                        <h3><u>Zone Letter:</u> ${markerZoneLetter}</h3>
                        <h3><u>Zone Number:</u> ${markerZoneNumber}</h3>`;
  marker.bindPopup(popupContent).openPopup();
  return marker.addTo(map);
}


// *********************************************************************************** //
// * DOM Elements - (Example Info Box)                                               * //
// *********************************************************************************** //
const numberOfMarkers = document.querySelector('.numberOfLayers > .div6');
const numberOfLayers = document.querySelector('.numberOfLayers > .div2');
const currentMapZoom = document.querySelector('.numberOfLayers > .div4');
const cursorCoordinates = document.querySelector('.cursorCoordinates');


// *********************************************************************************** //
// * Leaflet.DumbMGRS - DOM Elements - Switches                                      * //
// *********************************************************************************** //
const switch1000MLabels = document.querySelector('#grids1000Meters-labels');
const switch1000MGrids = document.querySelector('#grids1000Meters-grids');
const switch100KLabels = document.querySelector('#grids100k-labels');
const switch100KGrids = document.querySelector('#grids100k-grids');
const switchGZDLabels = document.querySelector('#gzd-labels');
const switchGZDGrids = document.querySelector('#gzd-grids');


// *********************************************************************************** //
// * Leaflet.DumbMGRS - Grid Toggle Switches on Zoom Level                           * //
// *********************************************************************************** //
// Automatically disabled switches that cannot be used at certain zoom levels
map.whenReady(() => {
  const switchValidator = () => {
    // 1000 meter grids - zoom level 12
    if (map.getZoom() < generate1000meterGrids.options.minZoom) {
      switch1000MLabels.setAttribute('disabled', true);
      switch1000MGrids.setAttribute('disabled', true);
    } else {
      generate1000meterGrids.options.showGrids ? switch1000MGrids.checked = true : switch1000MGrids.checked = false;
      generate1000meterGrids.options.showLabels ? switch1000MLabels.checked = true : switch1000MLabels.checked = false;
      switch1000MLabels.removeAttribute('disabled');
      switch1000MGrids.removeAttribute('disabled');
    }
    // 100k grids - zoom level 6
    if (map.getZoom() < generate100kGrids.options.minZoom) {
      switch100KLabels.setAttribute('disabled', true);
      switch100KGrids.setAttribute('disabled', true);
    } else {
      generate100kGrids.options.showGrids ? switch100KGrids.checked = true : switch100KGrids.checked = false;
      generate100kGrids.options.showLabels ? switch100KLabels.checked = true : switch100KLabels.checked = false;
      switch100KLabels.removeAttribute('disabled');
      switch100KGrids.removeAttribute('disabled');
    }
    // GZD - zoom level 3
    if (map.getZoom() < generateGZDGrids.options.minZoom) {
      switchGZDLabels.setAttribute('disabled', true);
      switchGZDGrids.setAttribute('disabled', true);
    } else {
      generateGZDGrids.options.showGrids ? switchGZDGrids.checked = true : switchGZDGrids.checked = false;
      generateGZDGrids.options.showLabels ? switchGZDLabels.checked = true : switchGZDLabels.checked = false;
      switchGZDLabels.removeAttribute('disabled');
      switchGZDGrids.removeAttribute('disabled');
    }
  };
  map.on('zoomend', switchValidator);
  switchValidator();
});


// *********************************************************************************** //
// * Leaflet.DumbMGRS - Event Listeners                                              * //
// *********************************************************************************** //
// Toggle 1000 meter labels
switch1000MLabels.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    switch1000MLabels.toggleAttribute('checked');
    generate1000meterGrids.showLabels();
  } else {
    switch1000MLabels.toggleAttribute('checked');
    generate1000meterGrids.hideLabels();
  }
});

// Toggle 1000 meter grids
switch1000MGrids.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    switch1000MGrids.toggleAttribute('checked');
    generate1000meterGrids.showGrids();
  } else {
    switch1000MGrids.toggleAttribute('checked');
    generate1000meterGrids.hideGrids();
  }
});

// Toggle 100k labels
switch100KLabels.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    switch100KLabels.toggleAttribute('checked');
    generate100kGrids.showLabels();
  } else {
    switch100KLabels.toggleAttribute('checked');
    generate100kGrids.hideLabels();
  }
});

// Toggle 100k grids
switch100KGrids.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    switch100KGrids.toggleAttribute('checked');
    generate100kGrids.showGrids();
  } else {
    switch100KGrids.toggleAttribute('checked');
    generate100kGrids.hideGrids();
  }
});

// Toggle GZD labels
switchGZDLabels.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    switchGZDLabels.toggleAttribute('checked');
    generateGZDGrids.showLabels();
  } else {
    switchGZDLabels.toggleAttribute('checked');
    generateGZDGrids.hideLabels();
  }
});

// Toggle GZD grids
switchGZDGrids.addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    switchGZDGrids.toggleAttribute('checked');
    generateGZDGrids.hideGrids();
  } else {
    switchGZDGrids.toggleAttribute('checked');
    generateGZDGrids.showGrids();
  }
});


// *********************************************************************************** //
// * Event Listeners (Example Info Boxes)                                            * //
// *********************************************************************************** //
// Update the MGRS coordinates when the mouse cursor moves (For accuracy checking)
map.addEventListener('mousemove', (event) => {
  // Display cursor coordinates in MGRS
  cursorCoordinates.querySelector('.mgrsInfo').innerHTML = `${UTMtoMGRS(LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }), 5, true)}`;
  // Display cursor coordinates in Latitude/Longitude
  cursorCoordinates.querySelector('.latInfo').innerHTML = `${event.latlng.lat.toFixed(8)}`;
  cursorCoordinates.querySelector('.lonInfo').innerHTML = `${event.latlng.lng.toFixed(8)}`;
  // Display cursor coordinates in Easting/Northing
  cursorCoordinates.querySelector('.eastingInfo').innerHTML = `${LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }).easting}`;
  cursorCoordinates.querySelector('.northingInfo').innerHTML = `${LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }).northing}`;
});

// Update layer count, marker count, and map zoom when the user stops moving the map
map.addEventListener('moveend', () => {
  setTimeout(() => {
    numberOfLayers.innerHTML = `${document.querySelectorAll('.leaflet-zoom-animated > g > path').length}`;
    currentMapZoom.innerHTML = `${map.getZoom()}`;
    numberOfMarkers.innerHTML = `${document.querySelectorAll('.leaflet-grid-label').length}`;
  }, 300);
}, { once: true });

// Add the layer data when the page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    cursorCoordinates.querySelector('.mgrsInfo').innerHTML = `${UTMtoMGRS(LLtoUTM({ lat: map.getCenter().lat, lon: map.getCenter().lng }), 5, true)}`;
    // Display cursor coordinates in Latitude/Longitude
    cursorCoordinates.querySelector('.latInfo').innerHTML = `${map.getCenter().lat.toFixed(8)}`;
    cursorCoordinates.querySelector('.lonInfo').innerHTML = `${map.getCenter().lng.toFixed(8)}`;
    // Display cursor coordinates in Easting/Northing
    cursorCoordinates.querySelector('.eastingInfo').innerHTML = `${LLtoUTM({ lat: map.getCenter().lat, lon: map.getCenter().lng }).easting}`;
    cursorCoordinates.querySelector('.northingInfo').innerHTML = `${LLtoUTM({ lat: map.getCenter().lat, lon: map.getCenter().lng }).northing}`;
    numberOfLayers.innerHTML = `${document.querySelectorAll('.leaflet-zoom-animated > g > path').length}`;
    currentMapZoom.innerHTML = `${map.getZoom()}`;
    numberOfMarkers.innerHTML = `${document.querySelectorAll('.leaflet-grid-label').length}`;
  }, 300);
});

// Automatically update the layers on toggle
document.querySelectorAll('.sw').forEach((toggleSwitch) => {
  toggleSwitch.addEventListener('change', () => {
    setTimeout(() => {
      numberOfLayers.innerHTML = `${document.querySelectorAll('.leaflet-zoom-animated > g > path').length}`;
      numberOfMarkers.innerHTML = `${document.querySelectorAll('.leaflet-grid-label').length}`;
    }, 100);
  });
});
