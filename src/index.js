/* eslint-disable max-len */
// Import stylesheets
import './styles.scss';
// Import Leaflet
import L from 'leaflet';
// Import the default marker icons from leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
// LLtoUTM and UTMtoLL aren't exported in the original mgrs.js, fork it and import them
// https://github.com/proj4js/mgrs/issues/10
import {
  forward, getLetterDesignator, inverse, toPoint, get100kSetForZone, get100kID, LLtoUTM, UTMtoLL, decode, encode, UTMtoMGRS,
} from './mgrs';
import { northingDict, eastingDict } from './gzdObject';

// *********************************************************************************** //
// * Global Vars/Leaflet setup/Predefined coordinates                                * //
// *********************************************************************************** //
// This coordinate has 3 visible Grid Zone Designator boundaries at zoom level 7 with no northing GZD
const ontarioCA = [51.84935276370605, -86.27563476562501]; // ? 262 child elements
// This coordinate has 6 visible Grid Zone Designator boundaries at zoom level 7
const southNY = [42.285437007491545, -75.04211425781251]; // ? 800 child elements
// This coordinate has 4 visible Grid Zone Designator boundaries within view
const southPA = [40.001780202770966, -78.0005693435669]; // ? 616 child elements
// For some reason the Florida map view generates a ton of child elements
const southFL = [27.381523191705053, -82.82592773437501]; // ? 2235 child elements
const honduras = [14.83861155338482, -87.45117187500001]; // ? 1272 child elements
const norway = [64.27322328178597, 5.603027343750001]; // ? 352 child elements
const iceland = [64.94216049820734, -19.797363281250004]; // ? 140 child elements on 18JAN, 132 elements on 21JAN
const northOfSvalbard = [83.02621885344846, 15.402832031250002]; // use zoom 6
const quito = [0.17578097424708533, -77.84912109375];
const map = L.map('map').setView(southNY, 7);
const cc = document.querySelector('.cursorCoordinates');
window.map = map;
// Just a quicker way to add a marker, used for debugging purposes
function mark(element) {
  const marker = new L.marker(element);
  const markerLat = marker.getLatLng().lat;
  const markerLng = marker.getLatLng().lng;
  const markerNorthing = LLtoUTM({ lat: markerLat, lon: markerLng }).northing;
  const markerEasting = LLtoUTM({ lat: markerLat, lon: markerLng }).easting;
  const markerZoneletter = LLtoUTM({ lat: markerLat, lon: markerLng }).zoneLetter;
  const markerZoneNumber = LLtoUTM({ lat: markerLat, lon: markerLng }).zoneNumber;
  const popupContent = `<h3><u>Lat:</u> ${markerLat.toFixed(6)} <u>Lng:</u> ${markerLng.toFixed(6)}</h3>
                        <h3><u>Northing:</u> ${markerNorthing}</h3>
                        <h3><u>Easting:</u> ${markerEasting}</h3>
                        <h3><u>Zone Letter:</u> ${markerZoneletter}</h3>
                        <h3><u>Zone Number:</u> ${markerZoneNumber}</h3>`;
  marker.bindPopup(popupContent).openPopup();
  return marker.addTo(map);
}

// *********************************************************************************** //
// * Enable default images in the marker                                             * //
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

// *********************************************************************************** //
// * Update the MGRS coordinates when the mouse cursor moves (For accuracy checking) * //
// *********************************************************************************** //
map.addEventListener('mousemove', (event) => {
  // Display cursor coordinates in MGRS
  cc.querySelector('.mgrsInfo').innerHTML = `${UTMtoMGRS(LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }), 5, true)}`;
  // Display cursor coordinates in Latitude/Longitude
  cc.querySelector('.latInfo').innerHTML = `${event.latlng.lat.toFixed(8)}`;
  cc.querySelector('.lonInfo').innerHTML = `${event.latlng.lng.toFixed(8)}`;
  // Display cursor coordinates in Easting/Northing
  cc.querySelector('.eastingInfo').innerHTML = `${LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }).easting}`;
  cc.querySelector('.northingInfo').innerHTML = `${LLtoUTM({ lat: event.latlng.lat, lon: event.latlng.lng }).northing}`;
});


// *********************************************************************************** //
// * Leaflet DumbMGRS Plugin - Grid Zone Designators (This works just fine)          * //
// *********************************************************************************** //
class GZD extends L.LayerGroup {
  constructor(northObj, eastObj) {
    super();
    this.northObj = northObj;
    this.eastObj = eastObj;
    this.viz = [];
    return this.getInBoundsGZDs();
  }

  // Find all the Grid Zone Designators that are in your view
  getInBoundsGZDs() {
    // Do not create GZDs if the map is zoomed out at 4 or below
    if (map.getZoom() <= 3) { return; }
    // Combined the northingDict and eastingDict into one object
    const combinedObj = { ...this.northObj, ...this.eastObj };
    // Create an array to store the inBounds values for letter,top, and bottom
    const inBoundsLatitudeLetters = [];
    // Create an array to store the inBounds values for top, right, and id
    const inBoundsUTMNumbers = [];
    this.viz = [];
    const currentVisibleBounds = map.getBounds();

    Object.values(combinedObj).forEach((key) => {
      const { top } = key;
      const { bottom } = key;
      const { left } = key;
      const { right } = key;
      const { id } = key;

      // Since we don't want to create grids for what we can't see this returns all the valid inBounds properties in the northingDict
      if (currentVisibleBounds.getNorthEast().lat >= bottom && currentVisibleBounds.getSouthWest().lat <= top) {
        inBoundsLatitudeLetters.push(key);
      }
      // Same thing here but it returns the valid inBounds properties for the eastingDict
      if (currentVisibleBounds.getNorthEast().lng >= left && currentVisibleBounds.getSouthWest().lng <= right) {
        inBoundsUTMNumbers.push({ left, right, id });
      }
    });

    // Define the "id" property in this object so we can store all the values returned from inBoundsUTMNumbers
    inBoundsLatitudeLetters.forEach((e) => {
      const letterKey = e;
      Object.defineProperties(letterKey, {
        id: {
          value: inBoundsUTMNumbers.map((j) => j),
          writable: true,
        },
      });
    });

    // Iterate over all the returned values and instantiate the class to create the grids
    Object.values(inBoundsLatitudeLetters).forEach((key) => {
      const letterID = key.letter;
      const { top } = key;
      const { bottom } = key;

      for (let index = 0; index < key.id.length; index += 1) {
        const element = key.id[index];
        const { left } = element;
        const { right } = element;
        let { id } = element;
        // This appends the number "0" to GZDs with an ID of less than 10
        // Without it the grids won't load since the ids will be parsed as a number
        // (eg- "01W" will default to "1W" which is invalid)
        if (id < 10) {
          id = `0${id}`;
        }
        this.buildGZD({
          top,
          bottom,
          letterID,
          left,
          right,
          id,
        });
      }
    });
  }


  buildGZD(params) {
    this.params = params;
    // Adjust coordinates for special GZDs around Norway and Svalbard
    const exceptionZones = `${this.params.id}${this.params.letterID}`;
    switch (exceptionZones) {
      case '31X':
        this.params.right = 9;
        break;
      case '32X':
        return;
      case '33X':
        this.params.left = 9;
        this.params.right = 21;
        break;
      case '34X':
        return;
      case '35X':
        this.params.left = 21;
        this.params.right = 33;
        break;
      case '36X':
        return;
      case '37X':
        this.params.left = 33;
        break;
      case '31V':
        this.params.right = 3;
        break;
      case '32V':
        this.params.left = 3;
        break;
      default:
        break;
    }
    // This is where the 100k grids gets it's data from
    this.viz.push({
      top: this.params.top,
      bottom: this.params.bottom,
      letterID: this.params.letterID,
      left: this.params.left,
      right: this.params.right,
      id: this.params.id,
    });

    const topLeft = new L.LatLng(this.params.top, this.params.left);
    const topRight = new L.LatLng(this.params.top, this.params.right);
    const bottomRight = new L.LatLng(this.params.bottom, this.params.right);
    // const bottomLeft = new L.LatLng(this.params.bottom, this.params.left);
    // We do not need bottomLeft and topLeft on the gzdBox, since they just overlap anyways
    const gzdBox = [topLeft, topRight, bottomRight];
    const gzdPolylineBox = new L.Polyline(gzdBox, {
      color: 'red',
      weight: 5,
      opacity: 0.5,
      smoothFactor: 1,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
      noClip: true,
      // Keep interactive false, else the symbols cannot be dropped on polylines
      interactive: false,
      // className: `gzd_${this.params.id}${this.params.letterID}`,
    });

    const gzdPolylineBounds = gzdPolylineBox.getBounds();
    const gzdIdSVG = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // Once the polylines are added to the map we can begin centering the Grid Zone Designator
    gzdIdSVG.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Put this into an event listener where if the map zoom is <=7, adjust viewBox to '0 0 200 100' or something
    gzdIdSVG.setAttribute('viewBox', '75 50 50 50');
    gzdIdSVG.innerHTML = `
        <rect width="200" height="100" fill="salmon" stroke="black" stroke-width="1" fill-opacity="0.5"/>
        <text x="100" y="50" fill="black" font-weight="bold" font-family="Arial" font-size="80" text-anchor="middle" dominant-baseline="central">${this.params.id}${this.params.letterID}</text>`;
    // Get the difference between the north east and southwest latitudes/longitudes and divide by 2
    const halfLat = (gzdPolylineBounds.getNorthEast().lat - gzdPolylineBounds.getSouthWest().lat) / 2; // (eg- 40.000 - 48.000 / 2 = 4)
    const halfLng = (gzdPolylineBounds.getNorthEast().lng - gzdPolylineBounds.getSouthWest().lng) / 2; // (eg- -72.000 - -78.000 / 2 = 3)
    // Now add those values to the southwest latitude/longitude to get the center point of the GZD
    const centerLat = gzdPolylineBounds.getSouthWest().lat + halfLat;
    const centerLng = gzdPolylineBounds.getSouthWest().lng + halfLng;
    // Add or subtract a small number on the center latitudes/longitudes, this will give us a legitimate new LatLngBounds
    // Add the pad() method at the end to add padding on all sides of the new boundaries so the GZD ID label can fit
    const centerBounds = new L.LatLngBounds([centerLat + 0.01, centerLng - 0.01], [centerLat - 0.01, centerLng + 0.01]).pad(10.5);
    // Now add the GZD overlays to the center of the GZD
    const gzdLabels = new L.svgOverlay(gzdIdSVG, centerBounds);
    // combine the polylines and the grid labels into their own group
    const gzdGroup = new L.LayerGroup([gzdPolylineBox, gzdLabels]);
    gzdGroup.addTo(map);
    map.addEventListener('moveend', () => {
      map.removeLayer(gzdGroup);
    }, { once: true });
  }

  // these events will be added and removed from the map with the layer
  getEvents() {
    return {
      moveend: this.reset,
    };
  }

  // Reset the grid on move end
  reset() {
    this.getInBoundsGZDs();
  }
}

export const gz = new GZD(eastingDict, northingDict);
gz.addTo(map);


// *********************************************************************************** //
// * Leaflet DumbMGRS Plugin - 100k Grids (this sorta works?)                        * //
// *********************************************************************************** //
// If there is a high zoom level, we need to add more padding so the grids generate throughout the whole screen
function getPaddingOnZoomLevel() {
  const northBuffer = map.getBounds().getNorth() >= 62 ? 0.2 : 0;
  const zoom = map.getZoom();

  if (zoom >= 18) {
    return 800;
  }

  switch (zoom) {
    case 17:
      return 400;
    case 16:
      return 200;
    case 15:
      return 100;
    case 14:
      return 50;
    case 13:
      return 25;
    case 12:
      return 12;
    case 11:
      return 6;
    case 10:
      return 3 + northBuffer;
    case 9:
      return 0.7 + northBuffer;
    case 8:
      return 0.3 + northBuffer;
    case 7:
      return 0.2 + northBuffer;
    case 6:
      return 0.1 + northBuffer;
    default:
      break;
  }
}

//! Issues:
//! Grids fail around Antarctica
//! Grids fail on GZD 31U,31V and 32V (These are the "special" case grid zones)
//! Grid labels for the connecting lines do not show up
function Grid100K() {
  // Note: any comment with the word GZD means "Grid Zone Designator". It's a 1 million by 1 million grid
  this.constructor = function () {
    // Get the North/South/East/West visible bounds and add padding
    this.north = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getNorth();
    this.south = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getSouth();
    this.east = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getEast();
    this.west = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()).getWest();
    // The eastingArray and northingArray will hold the latlngs for our grids
    this.eastingArray = [];
    this.northingArray = [];
    this.lineOptions = {
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
    };
    // default line style for 100K grids
    this.lineStyle = {
      color: 'black',
      weight: 4,
      opacity: 0.5,
      ...this.lineOptions,
    };
    // line style for debugging
    this.greenLine = {
      color: 'green',
      weight: 8,
      opacity: 0.25,
      ...this.lineOptions,
    };
    // line style for debugging
    this.orangeLine = {
      color: 'orange',
      weight: 8,
      opacity: 0.25,
      ...this.lineOptions,
    };
    // line style for debugging
    this.redLine = {
      color: 'red',
      weight: 2,
      opacity: 0.75,
      ...this.lineOptions,
    };
    this.map = map;
    // gridInterval set at 100k meters, ideally this should be adjustable so I can use it for the 1000 meter grids
    this.gridInterval = 100000;
    // dumb name, but this temporarily holds the visible grids so I can iterate over them
    this.empty = [];
    // visible grid zones from this.empty will be dumped in here
    this.uniqueVisibleGrids = {};
    // Create a new layergroup to hold the grid lines
    this.layerGroup100k = new L.LayerGroup([]);
    this.labelN = [];
    this.labelS = [];
  };


  // Returns the visible grids on the map and their bounds
  this.getVizGrids = function () {
    // Prevent the map from drawing 100K grids when it is zoomed out too far.
    if (map.getZoom() < 6) {
      return;
    }
    // Calling constructor to get it's values (eg- this.northingArray, etc...)
    this.constructor();
    // empty the empty array (I really need a new name for this)
    this.empty.length = 0;
    // GZ is the variable name for the GZD class I instantiated earlier
    gz.viz.forEach((visibleGrid) => {
      // This will tell us what grid squares are visible on the map
      this.empty.push(visibleGrid);
    });
    // This just creates a neater object where I can parse the data easier
    this.uniqueVisibleGrids = Object.keys(this.empty).reduce((acc, k) => {
      const grid = this.empty[k].id;
      acc[grid] = acc[grid] || [];
      acc[grid].push(this.empty[k]);
      return acc;
    }, {});
    this.prepGrids(this.uniqueVisibleGrids);
  };

  // Now that we have the visible grids, we can iterate over them
  this.prepGrids = function (uniqueVisibleGrids) {
    this.uniqueVisibleGrids = uniqueVisibleGrids;
    const visibleGridsIterator = new Map(Object.entries(this.uniqueVisibleGrids));

    // Not sure how useful this promise is. It works fine with just a forEach loop
    //! use async/await or just a forEach loop?
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    visibleGridsIterator.forEach((grid) => {
      delay(20)
        .then(() => {
          // This is where all the grids are generated.
          this.generateGrids(grid);
          return delay(3000);
        })
        .catch((err) => {
          console.error(err);
        });
    });
  };

  this.generateGrids = function (data) {
    this.data = data;
    const buffer = 0.00001;
    Object.values(this.data).forEach((x) => {
      // Get the corners of the visible grids and convert them from latlon to UTM
      const sw = LLtoUTM({ lat: x.bottom + buffer, lon: x.left + buffer });
      const se = LLtoUTM({ lat: x.bottom + buffer, lon: x.right - buffer });
      const ne = LLtoUTM({ lat: x.top - buffer, lon: x.right - buffer });
      const nw = LLtoUTM({ lat: x.top - buffer, lon: x.left + buffer });

      const hemisphere = map.getCenter().lat <= 0 ? 'South' : 'North';
      let northingIteratorNorthHemisphere = sw.northing;
      let eastingIteratorNorthHemisphere = sw.easting;
      let northingIteratorSouthHemisphere = sw.northing;
      let eastingIteratorSouthHemisphere = nw.easting;

      // Check which hemisphere the user is in and make adjustments
      switch (hemisphere) {
        case 'North':
          // Find all northing grids that are divisible by 100,000
          if (sw.zoneLetter === ne.zoneLetter) {
            while (northingIteratorNorthHemisphere <= ne.northing) {
              // This loop basically checks to make sure the easting grid is divisible by 100K
              if (northingIteratorNorthHemisphere % this.gridInterval === 0) {
                this.northingArray.push({
                  northing: northingIteratorNorthHemisphere,
                  zoneNumber: sw.zoneNumber,
                  zoneLetter: sw.zoneLetter,
                });
                // Push the coordinates for the 100k grid labels
                this.labelN.push({
                  northing: northingIteratorNorthHemisphere + (this.gridInterval / 2),
                  zoneNumber: sw.zoneNumber,
                  zoneLetter: sw.zoneLetter,
                });
              }
              northingIteratorNorthHemisphere += 1;
            }
          }
          // Find all easting grids that are divisible by 100,000
          if (sw.zoneLetter === se.zoneLetter) {
            while (eastingIteratorNorthHemisphere <= se.easting) {
              if (eastingIteratorNorthHemisphere % this.gridInterval === 0) {
                this.eastingArray.push({
                  easting: eastingIteratorNorthHemisphere,
                  zoneNumber: sw.zoneNumber,
                  zoneLetter: sw.zoneLetter,
                });
                // Push the coordinates for the 100k grid labels
                this.labelS.push({
                  easting: eastingIteratorNorthHemisphere + this.gridInterval / 2,
                  zoneNumber: sw.zoneNumber,
                  zoneLetter: sw.zoneLetter,
                });
              }
              eastingIteratorNorthHemisphere += 1;
            }
          }
          break;
        case 'South':
          // Find all northing grids that are divisible by 100,000
          if (sw.zoneLetter === ne.zoneLetter) {
            while (northingIteratorSouthHemisphere <= ne.northing) {
              // This loop basically checks to make sure the easting grid is divisible by 100K
              if (northingIteratorSouthHemisphere % this.gridInterval === 0) {
                this.northingArray.push({
                  northing: northingIteratorSouthHemisphere,
                  zoneNumber: nw.zoneNumber,
                  zoneLetter: nw.zoneLetter,
                });
                this.labelN.push({
                  northing: northingIteratorSouthHemisphere + (this.gridInterval / 2),
                  zoneNumber: nw.zoneNumber,
                  zoneLetter: nw.zoneLetter,
                });
              }
              northingIteratorSouthHemisphere += 1;
            }
          }
          // Find all easting grids that are divisible by 100,000
          if (nw.zoneLetter === ne.zoneLetter) {
            while (eastingIteratorSouthHemisphere <= ne.easting) {
              if (eastingIteratorSouthHemisphere % this.gridInterval === 0) {
                this.eastingArray.push({
                  easting: eastingIteratorSouthHemisphere,
                  zoneNumber: nw.zoneNumber,
                  zoneLetter: nw.zoneLetter,
                });
                this.labelS.push({
                  easting: eastingIteratorSouthHemisphere + this.gridInterval / 2,
                  zoneNumber: nw.zoneNumber,
                  zoneLetter: nw.zoneLetter,
                });
              }
              eastingIteratorSouthHemisphere += 1;
            }
          }
          break;
        default:
          break;
      }
    });


    //* Build the northing grid lines *//
    Object.entries(this.northingArray).forEach((na) => {
      const northingGridsArray = [];
      const bottomNorthing = na[1];
      const southWestCorner = new L.latLng({ lat: this.south, lon: this.west });
      const northEastCorner = new L.latLng({ lat: this.north, lon: this.east });
      const bounds = new L.latLngBounds(southWestCorner, northEastCorner);
      const bottomRow = this.eastingArray.map((j) => {
        if (j.zoneNumber === bottomNorthing.zoneNumber && j.zoneLetter === bottomNorthing.zoneLetter) {
          return [j, bottomNorthing];
        }
      });

      // Since bottomRow now contains grids from this.northingArray and this.eastingArray, we can add them to the empty array to loop over later
      bottomRow.forEach((k) => {
        if (k) {
          const northingGrids = UTMtoLL({
            northing: k[1].northing,
            easting: k[0].easting,
            zoneNumber: k[0].zoneNumber,
            zoneLetter: k[0].zoneLetter,
          });
          // If the northingGrids are within the visible boundaries of the map, then push them to the array
          if (bounds.contains(northingGrids)) {
            northingGridsArray.push(northingGrids);
          }
        }
      });

      const len = northingGridsArray.length;
      for (let index = 0; index < len; index += 1) {
        const element = [northingGridsArray[index], northingGridsArray[index + 1]];
        const northingLine = new L.Polyline([element], this.lineStyle);
        // Create a special grid for oddball grid zones like Norway and Svalbard
        this.handleSpecialZones(element);
        // Since element is an array of objects, check if the 2nd element is available in the array IOT generate a complete grid
        if (element[1]) {
          // If the user is scrolled all the way up to the X zone, then just run cleanLine
          if (this.data[0].letterID === 'X') {
            this.cleanLine(northingLine, this.data[0].left, this.data[0].right);
          }
          // If element[1]'s longitude is less than the right GZD boundary longitude and greater than the left GZD boundary
          if (element[1].lon <= this.data[0].right && element[0].lon >= this.data[0].left) {
            // This is where the northingLine grids will be output from
            // Basically what this.cleanLine aims to do is clip any polylines that go past their GZD boundaries
            this.cleanLine(northingLine, this.data[0].left, this.data[0].right);
            // This will "connect" the 100k grid to the east and west end of the GZD
            let count = 0;
            while (count < this.data.length) {
              // If any Polylines are less than 100k meters away from the GZD, we can then start connecting them
              // Convert element[0] to a LatLng so we can use the distanceTo() method
              const connectingNorthingLineWest = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              this.connectingNorthingLine(connectingNorthingLineWest, element, 0, this.data, count, 'left');
              const connectingNorthingLineEast = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              this.connectingNorthingLine(connectingNorthingLineEast, element, 1, this.data, count, 'right');
              count += 1;
              break;
            }
          }
        }
      }
    });

    //* Build the easting grid lines *//
    Object.entries(this.eastingArray).forEach((ea) => {
      // This empty array will hold all latlngs generated from the "bottomRow" forEach loop.
      const eastingGridsArray = [];
      const bottomEasting = ea[1];
      const southWestCorner = new L.latLng({ lat: this.south, lon: this.west });
      const northEastCorner = new L.latLng({ lat: this.north, lon: this.east });
      const bounds = new L.latLngBounds(southWestCorner, northEastCorner);
      const bottomRow = this.northingArray.map((j) => {
        // match grid zones and grid IDs together
        if (j.zoneNumber === bottomEasting.zoneNumber && j.zoneLetter === bottomEasting.zoneLetter) {
          return [j, bottomEasting];
        }
      });

      // Since bottomRow now contains grids from this.northingArray and this.eastingArray, we can add them to the empty array to loop over later
      bottomRow.forEach((k) => {
        if (k) {
          const eastingGrids = UTMtoLL({
            northing: k[0].northing,
            easting: k[1].easting,
            zoneNumber: k[0].zoneNumber,
            zoneLetter: k[0].zoneLetter,
          });
          // If the eastingGrids are within the visible boundaries of the map, then push them to the array
          if (bounds.contains(eastingGrids)) {
            eastingGridsArray.push(eastingGrids);
          }
        }
      });

      // I was told that setting the length of the loop like this has better performance than just array.length
      const len = eastingGridsArray.length;
      for (let index = 0; index < len; index += 1) {
        const element = [eastingGridsArray[index], eastingGridsArray[index + 1]];
        const eastingLine = new L.Polyline([element], this.lineStyle);
        this.handleSpecialZones(element);
        // Since element is an array of objects, check if the 2nd element is available in the array IOT generate a complete grid
        if (element[1]) {
          // If element[1]'s longitude is less than the left boundary and greater than the right boundary
          if (element[0].lon > this.data[0].left && element[0].lon < this.data[0].right) {
            // Basically what this.cleanLine aims to do is clip any polylines that go past their GZD boundaries
            this.cleanLine(eastingLine, this.data[0].left, this.data[0].right);
            // Connect the easting lines to the north and south parts of the GZD
            // IOT get the bottom latitude for each grid we need to loop over it
            let count = 0;
            while (count < this.data.length) {
              // If any Polylines are less than 100k meters away from the GZD, we can then start connecting them
              const connectingEastingLineSouth = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              this.connectingEastingLine(connectingEastingLineSouth, element, 0, this.data, count, 'bottom');
              const connectingEastingLineNorth = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              this.connectingEastingLine(connectingEastingLineNorth, element, 1, this.data, count, 'top');
              count += 1;
            }
          }
        }
      }
    });

    // Adds the layergroup to the map and then clears out the easting/northing arrays
    return this.clearAll();
  };

  //! This function adds grid labels without using any other loops.
  //! Recommend that you explore this route instead of using this.genLabels()
  this.test = function (elem) {
    const grid100kData = LLtoUTM({ lat: elem.lat, lon: elem.lng || elem.lon });
    const grid100kLabel = new L.Marker(elem, {
      interactive: false,
      icon: new L.DivIcon({
        className: 'leaflet-grid-label',
        iconAnchor: new L.Point(-25, 50),
        html: `<div class="grid-label">${get100kID(grid100kData.easting, grid100kData.northing, grid100kData.zoneNumber)}</div>`,
      }),
    });
    this.layerGroup100k.addLayer(grid100kLabel);
  };

  // These 2 functions will "connect" the northing and easting 100k grid lines to their adjacent GZD
  // CONNECTOR is the connecting line we pass in (eg - connectingEastingLineSouth)
  // ELEMENT is the grid lines generated from the for loop. The element is an object with 2 arrays containing latlons
  // DATA is the GZD data (example, this.data contains info on the corner boundaries of the visible GZDs)
  // COUNT is the index used in the while loop
  // DIRECTION is the information we want to access in "this.data[count].top/bottom/left/right"
  this.connectingNorthingLine = function (connector, element, elementIndex, data, count, direction) {
    const southBuffer = this.south > -20 ? 1 : 1.51;
    if (connector.distanceTo({ lat: element[elementIndex].lat, lng: data[count][direction] }) <= this.gridInterval * southBuffer) {
      const northingGridLineEndpoint = LLtoUTM({ lat: connector.lat, lon: data[count][direction] });
      const extendedNorthingLine = UTMtoLL({
        northing: Math.round(northingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
        easting: northingGridLineEndpoint.easting,
        zoneNumber: northingGridLineEndpoint.zoneNumber,
        zoneLetter: northingGridLineEndpoint.zoneLetter,
      });
      const connectingNorthingLineToGZD = new L.Polyline([connector, extendedNorthingLine], this.lineStyle);
      this.layerGroup100k.addLayer(connectingNorthingLineToGZD);
      //! 84,000 is some bullshit number
      if (connector.distanceTo({ lat: element[elementIndex].lat, lng: data[count][direction] }) <= 84000) {
        // this.test({ lat: connector.lat, lon: data[count][direction] });
      }
    }
  };

  this.connectingEastingLine = function (connector, element, elementIndex, data, count, direction) {
    // If the map view latitude is above 60, then add a multiplier to the gridInterval since the 100k grids get more spaced out as you go north
    const northBuffer = this.north > 60 ? 1.5 : 1.03;
    if (connector.distanceTo({ lat: data[count][direction], lng: element[elementIndex].lon }) <= this.gridInterval * northBuffer) {
      const eastingGridLineEndpoint = LLtoUTM({ lat: data[count][direction], lon: connector.lng });
      const extendedEastingLine = UTMtoLL({
        northing: eastingGridLineEndpoint.northing,
        // round the easting so it lines up with the bottom grid.
        easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
        zoneNumber: eastingGridLineEndpoint.zoneNumber,
        zoneLetter: eastingGridLineEndpoint.zoneLetter,
      });
      const connectingEastingLineToGZD = new L.Polyline([connector, extendedEastingLine], this.lineStyle);
      this.layerGroup100k.addLayer(connectingEastingLineToGZD);
    }
  };

  // This function takes an easting or northing line and 2 bounds (left and right)
  // It returns a new line with the same slope but bounded
  // A line is defined by y = slope * x + b
  // The only difference here is testing first to see if bounds cut the line
  this.cleanLine = function (line, leftLongitudeLimit, rightLongitudeLimit) {
    // Line is going to be the eastingLine/northingLine variable the gets passed in
    const lineToClean = line.getLatLngs();
    // line style options passed in from eastingLine/northingLine
    const { options } = line;
    // pt1 is element[0]
    let pt1 = lineToClean[0][0];
    // pt2 is element[1]
    let pt2 = lineToClean[0][1];
    // slope is some funky math I copied from https://github.com/trailbehind/leaflet-grids
    const slope = (pt1.lat - pt2.lat) / (pt1.lng - pt2.lng);
    // adding some space to the longitude so lines are more accurate
    const lngBuffer = 0.00125;

    if (pt1.lng < leftLongitudeLimit) {
      const newLat = pt1.lat + (slope * (leftLongitudeLimit - pt1.lng) + lngBuffer);
      pt1 = new L.latLng(newLat, leftLongitudeLimit);
    }

    if (pt2.lng > rightLongitudeLimit) {
      const newLat = pt1.lat + (slope * (rightLongitudeLimit - pt1.lng) + lngBuffer);
      pt2 = new L.latLng(newLat, rightLongitudeLimit);
    }

    if (pt2.lng < leftLongitudeLimit) {
      const newLat = pt1.lat + (slope * (leftLongitudeLimit - pt1.lng) + lngBuffer);
      pt2 = new L.latLng(newLat, leftLongitudeLimit);
    }

    const newLine = new L.Polyline([pt1, pt2], options);
    if (pt2.lat > this.south) {
      this.layerGroup100k.addLayer(newLine);
    }
  };


  //! GZD 31U does not work when the GZDs to the north of it are in visible range
  // TODO: Finish configuring the special zones exceptions
  this.handleSpecialZones = function (element) {
    const elementUTM = LLtoUTM(element[0]);
    // 31V is that slim GZD between Norway and Britain.
    if (elementUTM.zoneNumber === 31 && elementUTM.zoneLetter === 'V') {
      if (elementUTM.northing % this.gridInterval === 0) {
        const specialLine = new L.Polyline([{ lat: element[0].lat, lng: element[0].lon }, UTMtoLL({
          northing: elementUTM.northing,
          easting: 499999,
          zoneNumber: elementUTM.zoneNumber,
          zoneLetter: elementUTM.zoneLetter,
        })], this.lineStyle);
        // 0.0179 is some dumbass number I came up with IOT adjust the specialLine2 start point in GZD 31V. It's not very accurate but 31V is a stupid fucking GZD and has no land on it anyways. Waste of my fucking time.
        const specialLine2 = new L.Polyline([{ lat: element[0].lat - 0.0179, lng: 0.0000001 }, UTMtoLL({
          northing: elementUTM.northing,
          easting: elementUTM.easting,
          zoneNumber: elementUTM.zoneNumber,
          zoneLetter: elementUTM.zoneLetter,
        })], this.lineStyle);
        this.layerGroup100k.addLayer(specialLine);
        this.layerGroup100k.addLayer(specialLine2);
      }
    }
    if (element[1]) {
      if (elementUTM.zoneNumber === 32 && elementUTM.zoneLetter === 'V') {
        // This is the western longitude of the previous GZD "31V"
        const westBounds = 3;
        if (element[1].lon > westBounds) {
          const eastingLine = new L.Polyline([element], this.lineStyle);
          const connectingNorthingLineWest = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
          //! Remove this if statement and use this.connectingLine()
          // If any Polylines are less than 100k meters away from the GZD, we can then start connecting them
          if (connectingNorthingLineWest.distanceTo({ lat: element[0].lat, lng: westBounds }) <= this.gridInterval) {
            const eastingGridLineEndpoint = LLtoUTM({ lat: connectingNorthingLineWest.lat, lon: westBounds });
            const extendedLineWest = UTMtoLL({
              northing: Math.round(eastingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
              easting: eastingGridLineEndpoint.easting,
              zoneNumber: eastingGridLineEndpoint.zoneNumber,
              zoneLetter: eastingGridLineEndpoint.zoneLetter,
            });
            const connectingNorthingLineWestToGZD = new L.Polyline([connectingNorthingLineWest, extendedLineWest], this.lineStyle);
            this.layerGroup100k.addLayer(connectingNorthingLineWestToGZD);
          }
          this.layerGroup100k.addLayer(eastingLine);
        }
      }
    }
  };

  //! this.test() does the same thing but without any loops
  this.genLabels = function () {
    Object.entries(this.labelN).forEach((na) => {
      const labelGridsArray = [];
      const bottomNorthing = na[1];
      const southWestCorner = new L.latLng({ lat: this.south, lon: this.west });
      const northEastCorner = new L.latLng({ lat: this.north, lon: this.east });
      const bounds = new L.latLngBounds(southWestCorner, northEastCorner);
      const bottomRow = this.labelS.map((j) => {
        if (j.zoneNumber === bottomNorthing.zoneNumber && j.zoneLetter === bottomNorthing.zoneLetter) {
          return [j, bottomNorthing];
        }
      });

      // Since bottomRow now contains grids from this.labelN and this.labelS, we can add them to the empty array to loop over later
      bottomRow.forEach((k) => {
        if (k) {
          const northingGrids = UTMtoLL({
            northing: k[1].northing,
            easting: k[0].easting,
            zoneNumber: k[0].zoneNumber,
            zoneLetter: k[0].zoneLetter,
          });

          const grid100kLabel = new L.Marker(northingGrids, {
            interactive: false,
            icon: new L.DivIcon({
              className: 'leaflet-grid-label',
              iconAnchor: new L.Point(10, 10),
              html: `<div class="grid-label">${get100kID(k[0].easting, k[1].northing, k[0].zoneNumber)}</div>`,
            }),
          });
          this.layerGroup100k.addLayer(grid100kLabel);

          // If the northingGrids are within the visible boundaries of the map, then push them to the array
          if (bounds.contains(northingGrids)) {
            labelGridsArray.push(northingGrids);
          }
        }
      });

      // for (let index = 0; index < labelGridsArray.length; index += 1) {
      //   const element = [labelGridsArray[index], labelGridsArray[index + 1]];
      //   if (element[1]) {
      //     const grid100kData = LLtoUTM(element[0]);
      //     const grid100kLabel = new L.Marker(element[0], {
      //       interactive: false,
      //       icon: new L.DivIcon({
      //         className: 'leaflet-grid-label',
      //         iconAnchor: new L.Point(10, 10),
      //         html: `<div class="grid-label">${get100kID(grid100kData.easting, grid100kData.northing, grid100kData.zoneNumber)}</div>`,
      //       }),
      //     });
      //     // this.layerGroup100k.addLayer(grid100kLabel);
      //   }
      // }
    });
  };

  this.clearAll = function () {
    this.genLabels();
    this.layerGroup100k.addTo(map);
    this.eastingArray = [];
    this.northingArray = [];
    this.labelN = [];
    this.labelS = [];
  };

  this.regenerate = function () {
    if (this.layerGroup100k) {
      this.layerGroup100k.clearLayers();
      return this.getVizGrids();
    }
  };
}
// Create a new class and give it some boundaries
const generate1000meterGrids = new Grid100K(new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()));
// Run the class on page load
generate1000meterGrids.getVizGrids();


// *********************************************************************************** //
// * Event Listeners                                                                 * //
// *********************************************************************************** //
map.addEventListener('moveend', () => {
  // removes and adds the 100k grids to the map on moveend
  generate1000meterGrids.regenerate();
  // Clear the grids off the map
  // generate1000meterGrids.clearAll();
  // Run it again
  // generate1000meterGrids.getVizGrids();
  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
  }, 300);
}, { once: true });

// Add the layer data when the page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
  }, 300);
});

export { map };
