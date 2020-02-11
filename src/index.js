/* eslint-disable no-console */
/* eslint-disable no-underscore-dangle */
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
const map = L.map('map').setView(southFL, 7);
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
// TODO: Convert this to a proper leaflet plugin
// TODO: Split the plugin off into its own JS file (with the eastingDict/northingDict)
// TODO: Add the showLabels, hideLabels, showGrids, and hideGrids methods and wire them up to the switches
// TODO: Tree shake mgrs.js
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
// TODO: Rename this.empty to something logical
// TODO: Fix northing grid errors for zone letter X
L.MGRS100K = L.LayerGroup.extend({
  // Default options
  options: {
    showLabels: false,
    showGrids: false,
    maxZoom: 18,
    minZoom: 6,
    redraw: 'moveend',
    gridLetterStyle: 'color: #216fff; font-size:12px;',
  },
  // default line style for 100K grids
  lineStyle: {
    color: 'black',
    weight: 4,
    opacity: 0.5,
    interactive: false,
    fill: false,
    noClip: true,
    smoothFactor: 4,
    lineCap: 'butt',
    lineJoin: 'miter-clip',
  },
  // line style for debugging
  get blueLine() {
    const propertyToModify = {
      color: 'blue',
      weight: 4,
      opacity: 0.5,
    };
    const modifiedTarget = { ...this.lineStyle, ...propertyToModify };
    return modifiedTarget;
  },
  // line style for debugging
  get orangeLine() {
    const propertyToModify = {
      color: 'orange',
      weight: 8,
      opacity: 0.25,
    };
    const modifiedTarget = { ...this.lineStyle, ...propertyToModify };
    return modifiedTarget;
  },

  initialize(options) {
    this._map = map;
    // Not sure what this does but the plugin will fail without it
    L.LayerGroup.prototype.initialize.call(this);
    // Get the North/South/East/West visible bounds and add padding
    this.north = new L.latLngBounds(this._map.getBounds()).pad(this.getPaddingOnZoomLevel(this._map)).getNorth();
    this.south = new L.latLngBounds(this._map.getBounds()).pad(this.getPaddingOnZoomLevel(this._map)).getSouth();
    this.east = new L.latLngBounds(this._map.getBounds()).pad(this.getPaddingOnZoomLevel(this._map)).getEast();
    this.west = new L.latLngBounds(this._map.getBounds()).pad(this.getPaddingOnZoomLevel(this._map)).getWest();
    // The eastingArray and northingArray will hold the latlngs for our grids
    this.eastingArray = [];
    this.northingArray = [];
    // dumb name, but this temporarily holds the visible grids so I can iterate over them
    this.empty = [];
    // visible grid zones from this.empty will be dumped in here
    this.uniqueVisibleGrids = {};
    // gridInterval set at 100k meters, ideally this should be adjustable so I can use it for the 1000 meter grids
    this.gridInterval = 100000;
  },

  onAdd(map) {
    this._map = map;
    const graticule = this.getVizGrids();
    //! Cannot use 'move' event or it will freeze the entire app
    this._map.on(`viewreset ${this.options.redraw}`, graticule.getVizGrids, graticule);
  },

  onRemove(map) {
    this._map = map;
    this._map.off(`viewreset ${this.options.redraw}`, this._map);
  },

  hideGrids() {
    this.options.showGrids = true;
    this.getVizGrids();
  },

  hideLabels() {
    this.options.showLabels = false;
    this.getVizGrids();
  },

  showGrids() {
    this.options.showGrids = false;
    this.getVizGrids();
  },

  showLabels() {
    this.options.showLabels = true;
    this.getVizGrids();
  },

  getVizGrids() {
    // Clear every grid off the map
    this.clearLayers();
    const currentZoom = this._map.getZoom();
    if ((currentZoom >= this.options.minZoom) && (currentZoom <= this.options.maxZoom)) {
      // empty the arrays so we can redraw the grids
      this.empty = [];
      this.eastingArray = [];
      this.northingArray = [];
      this.north = new L.latLngBounds(this._map.getBounds()).pad(this.getPaddingOnZoomLevel(this._map)).getNorth();
      this.south = new L.latLngBounds(this._map.getBounds()).pad(this.getPaddingOnZoomLevel(this._map)).getSouth();
      this.east = new L.latLngBounds(this._map.getBounds()).pad(this.getPaddingOnZoomLevel(this._map)).getEast();
      this.west = new L.latLngBounds(this._map.getBounds()).pad(this.getPaddingOnZoomLevel(this._map)).getWest();
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
    }
    return this;
  },

  prepGrids(uniqueVisibleGrids) {
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
  },

  generateGrids(data) {
    this.data = data;
    const buffer = 0.00001;
    if (!this.options.showGrids) {
      return;
    }
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
          //! gen grid labels
          if (this.options.showLabels) {
            this.genLabels(k[1].northing, k[0].easting, k[0].zoneNumber, k[0].zoneLetter);
          }

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
              const connectingNorthingLineEast = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              this.connectingNorthingLine(connectingNorthingLineWest, element, 0, this.data, count, 'left');
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
              const connectingEastingLineNorth = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              this.connectingEastingLine(connectingEastingLineSouth, element, 0, this.data, count, 'bottom');
              this.connectingEastingLine(connectingEastingLineNorth, element, 1, this.data, count, 'top');
              count += 1;
            }
          }
        }
      }
    });
  },

  // This function takes an easting or northing line and 2 bounds (left and right)
  // It returns a new line with the same slope but bounded
  // A line is defined by y = slope * x + b
  // The only difference here is testing first to see if bounds cut the line
  cleanLine(line, leftLongitudeLimit, rightLongitudeLimit) {
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
      // ensures that the grid lines are valid northings
      // since some of them will have northing values of like 5799999, just round up
      if ((Math.round(LLtoUTM(pt1).northing / 10) * 10) % this.gridInterval === 0) {
        this.addLayer(newLine);
      }
    }
  },

  // These next 2 functions will "connect" the northing and easting 100k grid lines to their adjacent GZD
  // CONNECTOR is the connecting line we pass in (eg - connectingEastingLineSouth)
  // ELEMENT is the grid lines generated from the for loop. The element is an object with 2 arrays containing latitudes & longitudes
  // DATA is the GZD data (example, this.data contains info on the corner boundaries of the visible GZDs)
  // COUNT is the index used in the while loop
  // DIRECTION is the information we want to access in "this.data[count].top/bottom/left/right"
  connectingEastingLine(connector, element, elementIndex, data, count, direction) {
    // If the map view latitude is above 60, then add a multiplier to the gridInterval since the 100k grids get more spaced out as you go north
    const northBuffer = this.north > 60 ? 1.5 : 1.03;
    const connectorDistance = connector.distanceTo({ lat: data[count][direction], lng: element[elementIndex].lon });
    if (connectorDistance <= this.gridInterval * northBuffer) {
      const eastingGridLineEndpoint = LLtoUTM({ lat: data[count][direction], lon: connector.lng });
      const extendedEastingLine = UTMtoLL({
        northing: eastingGridLineEndpoint.northing,
        // round the easting so it lines up with the bottom grid.
        easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
        zoneNumber: eastingGridLineEndpoint.zoneNumber,
        zoneLetter: eastingGridLineEndpoint.zoneLetter,
      });

      const connectingEastingLineToGZD = new L.Polyline([connector, extendedEastingLine], this.lineStyle);
      // since some of them will have northing values of like 5799999, just round up
      if ((Math.round(LLtoUTM(connectingEastingLineToGZD.getLatLngs()[0]).northing / 10) * 10) % this.gridInterval === 0) {
        this.addLayer(connectingEastingLineToGZD);
      }
    }
  },

  connectingNorthingLine(connector, element, elementIndex, data, count, direction) {
    const southBuffer = this.south > -20 ? 1 : 1.51;
    // This garbage code is useful for dealing with GZD columns that are crossing the 0 degree longitude plane
    if (data[count].id === '30' || data[count].id === '31') {
      if (connector.distanceTo({ lat: connector.lat, lon: this.data[0].left - 0.0001 }) <= this.gridInterval * southBuffer) {
        const northingGridLineEndpoint = LLtoUTM({ lat: connector.lat, lon: this.data[0].left - 0.0001 });
        const extendedNorthingLine = UTMtoLL({
          northing: Math.round(northingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
          easting: northingGridLineEndpoint.easting,
          zoneNumber: northingGridLineEndpoint.zoneNumber,
          zoneLetter: northingGridLineEndpoint.zoneLetter,
        });
        const connectingNorthingLineToGZD = new L.Polyline([connector, extendedNorthingLine], this.lineStyle);
        this.addLayer(connectingNorthingLineToGZD);
      }
      if (connector.distanceTo({ lat: connector.lat, lon: this.data[0].right + 0.0001 }) <= this.gridInterval * southBuffer) {
        const northingGridLineEndpoint = LLtoUTM({ lat: connector.lat, lon: this.data[0].right + 0.0001 });
        const extendedNorthingLine = UTMtoLL({
          northing: Math.round(northingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
          easting: northingGridLineEndpoint.easting,
          zoneNumber: northingGridLineEndpoint.zoneNumber,
          zoneLetter: northingGridLineEndpoint.zoneLetter,
        });
        const connectingNorthingLineToGZD = new L.Polyline([connector, extendedNorthingLine], this.lineStyle);
        this.addLayer(connectingNorthingLineToGZD);
      }
      return;
    }
    // For any other GZD, just run this
    const connectorDistance = connector.distanceTo({ lat: element[elementIndex].lat, lng: data[count][direction] });
    if (connectorDistance <= this.gridInterval * southBuffer) {
      const northingGridLineEndpoint = LLtoUTM({ lat: connector.lat, lon: data[count][direction] });
      const extendedNorthingLine = UTMtoLL({
        northing: Math.round(northingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
        easting: northingGridLineEndpoint.easting,
        zoneNumber: northingGridLineEndpoint.zoneNumber,
        zoneLetter: northingGridLineEndpoint.zoneLetter,
      });

      const connectingNorthingLineToGZD = new L.Polyline([connector, extendedNorthingLine], this.lineStyle);
      // since some of them will have easting values of like 5799999, just round up
      if ((Math.round(LLtoUTM(connectingNorthingLineToGZD.getLatLngs()[0]).easting / 10) * 10) % this.gridInterval === 0) {
        this.addLayer(connectingNorthingLineToGZD);
      }
    }
  },

  // TODO: Finish configuring the special zones exceptions
  handleSpecialZones(element) {
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
        this.addLayer(specialLine);
        this.addLayer(specialLine2);
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
            this.addLayer(connectingNorthingLineWestToGZD);
          }
          this.addLayer(eastingLine);
        }
      }
    }
  },

  genLabels(northingLabel, eastingLabel, zoneNumberLabel, zoneLetterLabel) {
    // do not fire off labels when the map is zoomed out
    if (this._map.getZoom() <= 6) {
      return;
    }

    let labelGrids = UTMtoLL({
      northing: northingLabel + this.gridInterval / 2,
      easting: eastingLabel,
      zoneNumber: zoneNumberLabel,
      zoneLetter: zoneLetterLabel,
    });
    const labelWestOfRightGZD = new L.latLng(labelGrids).distanceTo({ lat: labelGrids.lat, lng: this.data[0].right });
    const labelEastOfRightGZD = new L.latLng(labelGrids).distanceTo({ lat: labelGrids.lat, lng: this.data[0].left });

    // These are the labels that are right next to the LEFT of the visible GZD line
    if (labelWestOfRightGZD < this.gridInterval && labelWestOfRightGZD > this.gridInterval / 5) {
      labelGrids = UTMtoLL({
        northing: northingLabel + this.gridInterval / 2,
        easting: eastingLabel + (labelWestOfRightGZD / 2),
        zoneNumber: zoneNumberLabel,
        zoneLetter: zoneLetterLabel,
      });
      const labelGridsUTM = LLtoUTM(labelGrids);
      if (labelGrids.lon < this.data[0].right && labelGrids.lon > this.data[0].left) {
        const grid100kLabel = new L.Marker(labelGrids, {
          interactive: false,
          icon: new L.DivIcon({
            className: 'leaflet-grid-label',
            iconAnchor: new L.Point(10, 10),
            html: `<div class="grid-label">${get100kID(labelGridsUTM.easting, labelGridsUTM.northing, labelGridsUTM.zoneNumber)}</div>`,
          }),
        });
        if (this._map.getBounds().pad(0.1).contains(labelGrids)) {
          this.addLayer(grid100kLabel);
        }
      }
    }
    // These are the labels that are right next to the RIGHT of the visible GZD line
    if (labelEastOfRightGZD < this.gridInterval && labelEastOfRightGZD > this.gridInterval / 5) {
      labelGrids = UTMtoLL({
        northing: northingLabel + this.gridInterval / 2,
        easting: eastingLabel - (labelEastOfRightGZD / 2),
        zoneNumber: zoneNumberLabel,
        zoneLetter: zoneLetterLabel,
      });
      const labelGridsUTM = LLtoUTM(labelGrids);
      if (labelGrids.lon < this.data[0].right && labelGrids.lon > this.data[0].left) {
        const grid100kLabel = new L.Marker(labelGrids, {
          interactive: false,
          icon: new L.DivIcon({
            className: 'leaflet-grid-label',
            iconAnchor: new L.Point(10, 10),
            html: `<div class="grid-label">${get100kID(labelGridsUTM.easting, labelGridsUTM.northing, labelGridsUTM.zoneNumber)}</div>`,
          }),
        });
        if (this._map.getBounds().pad(0.1).contains(labelGrids)) {
          this.addLayer(grid100kLabel);
        }
      }
    }

    // These are the labels that are in between of the visible GZD lines
    labelGrids = UTMtoLL({
      northing: northingLabel + this.gridInterval / 2,
      easting: eastingLabel + this.gridInterval / 2,
      zoneNumber: zoneNumberLabel,
      zoneLetter: zoneLetterLabel,
    });
    const labelGridsUTM = LLtoUTM(labelGrids);

    // This is idiotic but I am going to keep it for now. 4 if statements is embarrassing ffs
    // Basically this finds all grids that are more than 50K meters from the right and left of the visible GZD lines
    if (new L.latLng(labelGrids).distanceTo({ lat: labelGrids.lat, lng: this.data[0].right }) > this.gridInterval / 2) {
      if (new L.latLng(labelGrids).distanceTo({ lat: labelGrids.lat, lng: this.data[0].left }) > this.gridInterval / 2) {
        if (labelGrids.lon < this.data[0].right && labelGrids.lon > this.data[0].left) {
          // This removes any "weird" eastings that are not divisible by 10. So for instance the easting "637851" would not pass this test
          // This also prevents labels overlapping
          if ((Math.round(labelGridsUTM.easting / 10) * 10) % this.gridInterval === this.gridInterval / 2) {
            const grid100kLabel = new L.Marker(labelGrids, {
              interactive: false,
              icon: new L.DivIcon({
                className: 'leaflet-grid-label',
                iconAnchor: new L.Point(10, 10),
                html: `<div class="grid-label">${get100kID(labelGridsUTM.easting, labelGridsUTM.northing, labelGridsUTM.zoneNumber)}</div>`,
              }),
            });
            // Only add grid labels that the user can see
            if (this._map.getBounds().pad(0.1).contains(labelGrids)) {
              this.addLayer(grid100kLabel);
            }
          }
        }
      }
    }
  },


  getPaddingOnZoomLevel(map) {
    this._map = map;
    const northBuffer = this._map.getBounds().getNorth() >= 62 ? 0.4 : 0;
    const zoom = this._map.getZoom();

    if (zoom >= 18) {
      return 400;
    }

    switch (zoom) {
      case 17:
        return 200;
      case 16:
        return 100;
      case 15:
        return 50;
      case 14:
        return 25;
      case 13:
        return 12;
      case 12:
        return 6;
      case 11:
        return 3;
      case 10:
        return 1 + northBuffer;
      case 9:
        return 0.7 + northBuffer;
      case 8:
        return 0.3 + northBuffer;
      case 7:
        return 0.15 + northBuffer;
      case 6:
        return 0.07 + northBuffer;
      default:
        break;
    }
    return this;
  },
});

L.mgrs100k = function (options) {
  return new L.MGRS100K(options);
};

const generate100kGrids = new L.mgrs100k({
  showLabels: false,
  showGrids: false,
});

generate100kGrids.addTo(map);


// *********************************************************************************** //
// * Leaflet DumbMGRS Plugin - 1000 Meter Grids                                      * //
// *********************************************************************************** //
// TODO: Rename this.empty to something descriptive. Come on Jim get your head out of your ass
// TODO: anything named "map" should be changed to this._map
// TODO: This plugin will get messed up on the southern hemisphere
// TODO: Remove legacy code (eg- setOptions on initialize)
L.MGRS1000Meters = L.LayerGroup.extend({
  options: {
    gridInterval: 1000,
    showLabels: true,
    hidden: false,
    redraw: 'move',
    maxZoom: 18,
    minZoom: 12,
    gridLetterStyle: 'color: black; font-size:12px;',
    splitGZD: false,
    direction: undefined,
  },

  lineStyle: {
    color: 'black',
    weight: 1,
    opacity: 0.5,
    interactive: false,
    clickable: false, // legacy support
    fill: false,
    noClip: true,
    smoothFactor: 4,
    lineCap: 'butt',
    lineJoin: 'miter-clip',
  },
  // line style for debugging
  get orangeLine() {
    const propertyToModify = {
      color: 'orange',
      weight: 8,
      opacity: 0.25,
    };
    const modifiedTarget = { ...this.lineStyle, ...propertyToModify };
    return modifiedTarget;
  },
  // line style for debugging
  get redLine() {
    const propertyToModify = {
      color: 'red',
      weight: 2,
      opacity: 0.75,
    };
    const modifiedTarget = { ...this.lineStyle, ...propertyToModify };
    return modifiedTarget;
  },

  initialize(options) {
    L.LayerGroup.prototype.initialize.call(this);
    //! setOptions might not be needed in Leaflet 1.6 since it is already declared in the source code. This was copied from a tutorial using Leaflet 0.7.3
    L.Util.setOptions(this, options);
  },

  onAdd(map) {
    this._map = map;
    const grids1000Meters = this.regenerate();
    this._map.on(`viewreset ${this.options.redraw} moveend`, grids1000Meters.regenerate, grids1000Meters);
    //! eachLayer might not be needed in Leaflet 1.6 since it is already declared in the source code. This was copied from a tutorial using Leaflet 0.7.3
    this.eachLayer(map.addLayer, map);
  },

  onRemove(map) {
    this._map = map;
    this._map.off(`viewreset ${this.options.redraw}`, this._map);
    //! eachLayer might not be needed in Leaflet 1.6 since it is already declared in the source code. This was copied from a tutorial using Leaflet 0.7.3
    this.eachLayer(this.removeLayer, this);
  },

  hideGrids() {
    this.options.hidden = true;
    this.regenerate();
  },

  hideLabels() {
    this.options.showLabels = false;
    this.regenerate();
  },

  showGrids() {
    this.options.hidden = false;
    this.regenerate();
  },

  showLabels() {
    this.options.showLabels = true;
    this.regenerate();
  },

  regenerate() {
    const currentZoom = this._map.getZoom();
    if (currentZoom < this.options.minZoom) {
      // Since we don't want to turn off the event listener, run eachLayer() instead of onRemove
      //! should just be this.clearLayers()
      return this.eachLayer(this.removeLayer, this);
    }
    this._bounds = this._map.getBounds().pad(this.getPaddingOnZoomLevel1000Meters());
    this.clearLayers();
    this.empty = [];

    if (currentZoom >= this.options.minZoom && currentZoom <= this.options.maxZoom) {
      // Call the GZD class and get the visible grid zone designators on the map
      gz.viz.forEach((visibleGrid) => {
        // This will tell us what grid squares are visible on the map
        this.empty.push(visibleGrid);
      });

      if (this.empty.length <= 1) {
        // If there is no other GZD visible on the map, then just run it
        this.generateGrids(this.options.splitGZD = false);
      } else {
        this.generateGrids(this.options.splitGZD = true, this.options.direction = 'right');
        this.generateGrids(this.options.splitGZD = true, this.options.direction = 'left');
      }
    }
    return this;
  },

  // Gets the minimum easting and northing of each 1000 meter grid line
  getMinimumBounds() {
    let nw;
    switch (this.options.direction) {
      case undefined: {
        nw = LLtoUTM({ lat: this._bounds.getNorth(), lon: this._bounds.getWest() });
        break;
      }
      case 'left': {
        nw = LLtoUTM({ lat: this._bounds.getNorth(), lon: this._bounds.getWest() });
        break;
      }
      case 'right': {
        nw = LLtoUTM({ lat: this._bounds.getNorth(), lon: this.empty[1].left });
        break;
      }
      default: {
        break;
      }
    }

    return {
      // rounds up to nearest multiple of x
      easting: Math.floor(nw.easting / this.options.gridInterval) * this.options.gridInterval,
      northing: Math.floor(nw.northing / this.options.gridInterval) * this.options.gridInterval,
      zoneNumber: nw.zoneNumber,
      zoneLetter: nw.zoneLetter,
    };
  },

  // Gets the number of easting and northing lines we need to draw on the map
  getLineCounts() {
    let east;
    let west;
    switch (this.options.direction) {
      case undefined: {
        // This will fix a bug where the GZD boundary is barely out of view
        // it adjusts the value so it grabs the furthest east/west boundary without going outside of the GZD
        east = this.empty[0].right > this._bounds.getEast() ? this._bounds.getEast() : this.empty[0].right - 0.00001;
        west = this.empty[0].left < this._bounds.getWest() ? this._bounds.getWest() : this.empty[0].left;
        break;
      }
      case 'left': {
        east = this.empty[0].right - 0.00001;
        west = this._bounds.getWest();
        break;
      }
      case 'right': {
        east = this._bounds.getEast();
        west = this.empty[1].left + 0.00001;
        break;
      }
      default: {
        break;
      }
    }

    const nw = LLtoUTM({ lat: this._bounds.getNorth(), lon: west });
    const ne = LLtoUTM({ lat: this._bounds.getNorth(), lon: east });
    const sw = LLtoUTM({ lat: this._bounds.getSouth(), lon: west });
    return {
      easting: Math.ceil((ne.easting - nw.easting) / this.options.gridInterval),
      northing: Math.ceil((nw.northing - sw.northing) / this.options.gridInterval),
    };
  },

  // Where the magic happens
  generateGrids(splitGZD = false, direction = undefined) {
    this.options.splitGZD = splitGZD;
    this.options.direction = direction;

    // Do not run this function if the grids hidden open is enabled
    if (this.options.hidden) {
      return;
    }

    const minimumBounds = this.getMinimumBounds();
    const gridCounts = this.getLineCounts();
    const gridLines = [];
    const gridLabels = [];

    //* * Easting Lines **//
    // Adding +1 on gridCounts.easting to fix error with connecting grid lines not showing up
    for (let i = 0; i <= gridCounts.easting + 1; i += 1) {
      const adjustedEasting = minimumBounds.easting + (this.options.gridInterval * i);
      const { northing } = minimumBounds;

      const northLine = UTMtoLL({
        northing,
        easting: adjustedEasting,
        zoneNumber: minimumBounds.zoneNumber,
        zoneLetter: minimumBounds.zoneLetter,
      });

      const southLine = UTMtoLL({
        northing: northing - (gridCounts.northing * this.options.gridInterval),
        easting: adjustedEasting,
        zoneNumber: minimumBounds.zoneNumber,
        zoneLetter: minimumBounds.zoneLetter,
      });

      const labelCoords = UTMtoLL({
        northing: LLtoUTM({ lat: map.getBounds().getSouth(), lon: southLine.lon }).northing,
        easting: adjustedEasting,
        zoneNumber: minimumBounds.zoneNumber,
        zoneLetter: minimumBounds.zoneLetter,
      });

      const eastingLine = new L.Polyline([southLine, northLine], this.lineStyle);

      // Slope is some funky math I copied from https://github.com/trailbehind/leaflet-grids
      // Used for any grid line that converges to the GZD boundaries
      const slope = (southLine.lat - northLine.lat) / (southLine.lon - northLine.lon);

      // This will ensure that the northing lines do not go past their GZD boundaries
      switch (this.options.direction) {
        case undefined:
          if (this.options.showLabels) {
            gridLabels.push(this.generateEastingLabel(labelCoords, adjustedEasting.toString().slice(1, -3)));
          }
          break;
        case 'left':
          if (northLine.lon >= this.empty[0].right) {
            const newLatLeft = southLine.lat + (slope * (this.empty[0].right - southLine.lon));
            eastingLine.setLatLngs([southLine, { lat: newLatLeft, lng: this.empty[0].right - 0.00001 }]);
          }
          if (labelCoords.lon <= this.empty[0].right && this.options.showLabels) {
            gridLabels.push(this.generateEastingLabel(labelCoords, adjustedEasting.toString().slice(1, -3)));
          }
          break;
        case 'right':
          if (northLine.lon <= this.empty[1].left) {
            const newLatRight = southLine.lat + (slope * (this.empty[1].left - southLine.lon));
            eastingLine.setLatLngs([southLine, { lat: newLatRight, lng: this.empty[1].left }]);
          }
          if (labelCoords.lon >= this.empty[1].left && this.options.showLabels) {
            gridLabels.push(this.generateEastingLabel(labelCoords, adjustedEasting.toString().slice(1, -3)));
          }
          break;
        default:
          break;
      }
      gridLines.push(eastingLine);
    }

    //* * Northing Lines **//
    for (let i = 0; i <= gridCounts.northing; i += 1) {
      const { easting } = minimumBounds;
      const adjustedNorthing = minimumBounds.northing - (this.options.gridInterval * i);

      let endEastingLineForNorthings;
      let beginEastingLineForNorthings;
      // If we need to get the northern bounds and we are in the southern hemisphere, grab the north, else grab the south
      const northernHemisphereBounds = map.getCenter().lat <= 0 ? this._bounds.getNorth() : this._bounds.getSouth();

      switch (this.options.direction) {
        case undefined: {
          beginEastingLineForNorthings = easting;
          endEastingLineForNorthings = easting + (gridCounts.easting * this.options.gridInterval);
          break;
        }
        case 'left': {
          beginEastingLineForNorthings = easting;
          endEastingLineForNorthings = LLtoUTM({ lat: northernHemisphereBounds, lon: this.empty[0].right - 0.00001 }).easting;
          break;
        }
        case 'right': {
          beginEastingLineForNorthings = LLtoUTM({ lat: northernHemisphereBounds, lon: this.empty[1].left + 0.00001 }).easting;
          endEastingLineForNorthings = easting + (gridCounts.easting * this.options.gridInterval);
          break;
        }
        default: {
          break;
        }
      }

      const westLine = UTMtoLL({
        northing: adjustedNorthing,
        easting: beginEastingLineForNorthings,
        zoneNumber: minimumBounds.zoneNumber,
        zoneLetter: minimumBounds.zoneLetter,
      });

      const eastLine = UTMtoLL({
        northing: adjustedNorthing,
        easting: endEastingLineForNorthings,
        zoneNumber: minimumBounds.zoneNumber,
        zoneLetter: minimumBounds.zoneLetter,
      });

      // These coordinates are the absolute western edge of the visible map
      const labelCoords = UTMtoLL({
        northing: adjustedNorthing,
        easting: LLtoUTM({ lat: westLine.lat, lon: map.getBounds().getWest() }).easting,
        zoneNumber: minimumBounds.zoneNumber,
        zoneLetter: minimumBounds.zoneLetter,
      });

      const northingLine = new L.Polyline([westLine, eastLine], this.lineStyle);

      // This will ensure that the northing lines do not go past their GZD boundaries
      switch (this.options.direction) {
        case undefined:
          // Putting the grid label options in the switch statement prevents them from duplicating if split GZDs are on screen
          if (this.options.showLabels) {
            // If adjustedNorthing is 4871000, then slice the first 2 chars off and then remove the last 3 to get "71" as your label
            gridLabels.push(this.generateNorthingLabel(labelCoords, adjustedNorthing.toString().slice(2, -3)));
          }
          break;
        case 'left':
          northingLine.setLatLngs([westLine, { lat: eastLine.lat, lng: this.empty[0].right - 0.00001 }]);
          if (this.options.showLabels) {
            gridLabels.push(this.generateNorthingLabel(labelCoords, adjustedNorthing.toString().slice(2, -3)));
          }
          break;
        case 'right':
          northingLine.setLatLngs([eastLine, { lat: westLine.lat, lng: this.empty[1].left }]);
          break;
        default:
          break;
      }

      gridLines.push(northingLine);
    }

    gridLines.forEach(this.addLayer, this);
    gridLabels.forEach(this.addLayer, this);
  },

  generateEastingLabel(pos, label) {
    const bounds = this._map.getBounds().pad(-0.001);
    return new L.Marker({ lat: bounds.getSouth(), lng: pos.lon }, {
      interactive: false,
      icon: new L.DivIcon({
        iconAnchor: [11, 22],
        className: 'leaflet-grid-label',
        html: `<div class="grid-label-1000m" style="${this.options.gridLetterStyle}">${label}</div>`,
      }),
    });
  },

  generateNorthingLabel(pos, label) {
    const bounds = this._map.getBounds().pad(-0.001);
    return new L.Marker({ lat: pos.lat, lng: bounds.getWest() }, {
      interactive: false,
      icon: new L.DivIcon({
        iconAnchor: [0, 8],
        className: 'leaflet-grid-label',
        html: `<div class="grid-label-1000m" style="${this.options.gridLetterStyle}">${label}</div>`,
      }),
    });
  },

  getPaddingOnZoomLevel1000Meters() {
    const zoom = this._map.getZoom();
    if (zoom >= this.options.maxZoom) {
      return 4;
    }
    switch (zoom) {
      case 17:
        return 1.5;
      case 16:
        return 0.75;
      case 15:
        return 0.4;
      case 14:
        return 0.18;
      case 13:
        return 0.1;
      case 12:
        return 0.04;
      default:
        break;
    }
    return this;
  },
});

L.mgrs1000meters = function (options) {
  return new L.MGRS1000Meters(options);
};

const generate1000meterGrids = new L.mgrs1000meters({
  showLabels: false,
  hidden: true,
});

generate1000meterGrids.addTo(map);


// *********************************************************************************** //
// * Event Listeners                                                                 * //
// *********************************************************************************** //
map.addEventListener('moveend', () => {
  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
    document.querySelector('.numberOfLayers > .div6').innerHTML = `${document.querySelectorAll('.leaflet-grid-label').length}`;
  }, 300);
}, { once: true });

// Add the layer data when the page loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
    document.querySelector('.numberOfLayers > .div6').innerHTML = `${document.querySelectorAll('.leaflet-grid-label').length}`;
  }, 300);
});

// Toggle labels on 1000 meter grids
document.querySelector('#grids1000Meters-labels').addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    document.querySelector('#grids1000Meters-labels').toggleAttribute('checked');
    generate1000meterGrids.showLabels();
  } else {
    document.querySelector('#grids1000Meters-labels').toggleAttribute('checked');
    generate1000meterGrids.hideLabels();
  }
});

// Toggle 1000 meter grids
document.querySelector('#grids1000Meters-grids').addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    document.querySelector('#grids1000Meters-grids').toggleAttribute('checked');
    generate1000meterGrids.showGrids();
  } else {
    document.querySelector('#grids1000Meters-grids').toggleAttribute('checked');
    generate1000meterGrids.hideGrids();
  }
});

// Toggle labels on 100k grids
document.querySelector('#grids100k-labels').addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    document.querySelector('#grids100k-labels').toggleAttribute('checked');
    generate100kGrids.showLabels();
  } else {
    document.querySelector('#grids100k-labels').toggleAttribute('checked');
    generate100kGrids.hideLabels();
  }
});

// Toggle 100k grids
document.querySelector('#grids100k-grids').addEventListener('change', (event) => {
  const checkbox = event.target;
  if (checkbox.checked) {
    document.querySelector('#grids100k-grids').toggleAttribute('checked');
    generate100kGrids.hideGrids();
  } else {
    document.querySelector('#grids100k-grids').toggleAttribute('checked');
    generate100kGrids.showGrids();
  }
});

export { map };
