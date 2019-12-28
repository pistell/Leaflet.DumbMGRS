// Import stylesheets
import './styles.scss';
// Import Leaflet
import L from 'leaflet';
// Import the default marker icons from leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
// LLtoUTM and UTMtoLL aren't exported in the original mgrs.js, fork it and import them
// https://github.com/proj4js/mgrs/issues/10
// TODO: Remove unused imports/exports from mgrs.js
import {
  forward, getLetterDesignator, inverse, toPoint, get100kSetForZone, get100kID, LLtoUTM, UTMtoLL, decode, encode, UTMtoMGRS,
} from './mgrs';

// *********************************************************************************** //
// * Global Vars/Leaflet setup                                                       * //
// *********************************************************************************** //
const map = L.map('map').setView([40.123503280320634, -77.74869918823244], 14);
const cc = document.querySelector('.cursorCoordinates');
window.map = map;

// *********************************************************************************** //
// * Enable default images in the marker                                             * //
// *********************************************************************************** //
// https://github.com/Leaflet/Leaflet/issues/4968#issuecomment-264311098
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
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

// *********************************************************************************** //
// * Update the MGRS coordinates when the mouse cursor moves                         * //
// *********************************************************************************** //
map.addEventListener('mousemove', (event) => {
  // Display cursor coordinates in MGRS
  cc.innerHTML = `<strong>MGRS:</strong>  <info>${UTMtoMGRS(LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }), 5, true)}</info>`;
  // Display cursor coordinates in Latitude/Longitude
  cc.innerHTML += `<br/><strong>LAT:</strong> <info>${event.latlng.lat.toFixed(8)}</info>  <strong>LNG:</strong> <info>${event.latlng.lng.toFixed(8)}</info>`;
  // Display cursor coordinates in Easting/Northing
  cc.innerHTML += `<br/><strong>EASTING:</strong><info> ${LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }).easting}</info><strong>NORTHING:</strong><info> ${LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }).northing}</info>`;
});
