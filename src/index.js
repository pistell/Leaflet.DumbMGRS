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
// * Global Vars/Leaflet setup                                                       * //
// *********************************************************************************** //
// This coordinate has no Grid Zone Designator boundaries within view
const noVisibleGZDs = [40.123503280320634, -77.74869918823244];
// This coordinate has 4 visible Grid Zone Designator boundaries within view
const between4GZDs = [40.001780202770966, -78.0005693435669];
// This coordinate has 6 visible Grid Zone Designator boundaries at zoom level 7
const between6GZDs = [42.285437007491545, -75.04211425781251];
// This coordinate has 3 visible Grid Zone Designator boundaries at zoom level 7 with no northing GZD
const between3GZDsNoEasting = [51.84935276370605, -86.27563476562501];
const map = L.map('map').setView(between6GZDs, 7);
const cc = document.querySelector('.cursorCoordinates');
window.map = map;

// *********************************************************************************** //
// * Enable default images in the marker                                             * //
// *********************************************************************************** //
// https://github.com/Leaflet/Leaflet/issues/4968#issuecomment-264311098
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  // icon is 25x41 pixels, so adjust anchor point
  iconAnchor: [12.5, 41],
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
        // This is where the 100k grids gets it's data from
        this.viz.push({
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
// * Leaflet DumbMGRS Plugin - 100k Grids (this does not work)                       * //
// *********************************************************************************** //
// If there is a high zoom level, we need to add more padding so the grids generate throughout the whole screen
function getPaddingOnZoomLevel() {
  if (map.getZoom() >= 17) {
    return 3;
  }
  if (map.getZoom() < 17 && map.getZoom() >= 15) {
    return 1;
  }
  if (map.getZoom() <= 14 && map.getZoom() >= 12) {
    return 0.15;
  }
  return 0.1;
}

// https://stackoverflow.com/questions/2218999/remove-duplicates-from-an-array-of-objects-in-javascript
function getUnique(arr, comp) {
  return arr
    .map((e) => e[comp])
    .map((e, i, final) => final.indexOf(e) === i && i) // store the keys of the unique objects
    .filter((e) => arr[e]).map((e) => arr[e]); // eliminate the dead keys & store unique objects
}

// Note: any comment with the word GZD means "Grid Zone Designator". It's a 1 million by 1 million grid
function Grid100K() {
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
      color: 'black',
      weight: 4,
      opacity: 0.5,
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
    };
    this.map = map;
    // gridInterval set at 100k, ideally this should be adjustable so I can use it for the 1000 meter grids
    this.gridInterval = 100000;
    // dumb name, but this temporarily holds the visible grids so I can iterate over them
    this.empty = [];
    // visible grid zones from this.empty will be dumped in here
    this.uniqueVisibleGrids = {};
    // Create a new layergroup to hold the grid lines
    this.layerGroup100k = new L.LayerGroup([]);
    return this;
  };


  // Returns the visible grids on the map and their bounds
  this.getVizGrids = function () {
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
    return this.prepGrids(this.uniqueVisibleGrids);
  };

  // Now that we have the visible grids, we can iterate over them
  this.prepGrids = function (uniqueVisibleGrids) {
    this.uniqueVisibleGrids = uniqueVisibleGrids;
    const visibleGridsIterator = new Map(Object.entries(this.uniqueVisibleGrids));

    // Not sure how useful this promise is. It works fine with just a forEach loop
    const delay = (ms) => new Promise(
      (resolve) => setTimeout(resolve, ms),
    );

    visibleGridsIterator.forEach((k) => {
      delay(20)
        .then(() => {
          // This is where all the grids are generated.
          this.generateGrids(k);
          return delay(3000);
        })
        .catch((err) => {
          console.error(err);
        });
    });
  };

  this.generateGrids = function (data) {
    this.data = data;
    Object.values(this.data).forEach((x) => {
      if (x.id) {
        // Get the corners of the visible grids and convert them from latlon to UTM
        const neLeft = LLtoUTM({ lat: x.top - 0.000001, lon: x.right - 0.000000001 });
        const seLeft = LLtoUTM({ lat: x.bottom, lon: x.right - 0.000000001 });
        const swLeft = LLtoUTM({ lat: x.bottom, lon: x.left });
        let leftEastingIterator = swLeft.easting;
        let leftNorthingIterator = swLeft.northing;

        //* Left Side Easting */
        while (leftEastingIterator <= seLeft.easting) {
          // This loop basically checks to make sure the grid easting is divisible by 100K
          // eg- "easting: 5200015" is a bad match
          // eg- "easting: 5200000" is a good match
          if (leftEastingIterator % this.gridInterval === 0) {
            this.eastingArray.push({
              easting: leftEastingIterator,
              zoneNumber: seLeft.zoneNumber,
              zoneLetter: seLeft.zoneLetter,
            });
            // console.log(this.eastingArray);
          }
          leftEastingIterator += 1;
        }

        //* * Left Side Northing */
        while (leftNorthingIterator <= neLeft.northing) {
          if (leftNorthingIterator % this.gridInterval === 0) {
            this.northingArray.push({
              northing: leftNorthingIterator,
              zoneNumber: neLeft.zoneNumber,
              zoneLetter: neLeft.zoneLetter,
            });
            // console.log(this.northingArray);
          }
          leftNorthingIterator += 1;
        }
      }
    });

    // Build the northing grids now
    Object.entries(this.northingArray).forEach((e) => {
      const bottomNorthing = e[1];
      const bottomRow = this.eastingArray.map((j) => [j, bottomNorthing]);
      const emptyBottomRowArr = [];

      bottomRow.forEach((k) => {
        emptyBottomRowArr.push(UTMtoLL({
          northing: k[1].northing,
          easting: k[0].easting,
          zoneNumber: k[0].zoneNumber,
          zoneLetter: k[0].zoneLetter,
        }));
      });

      // "emptyBottomRowArr.length - 1" prevents lines from overlapping...idk
      for (let index = 0; index < emptyBottomRowArr.length - 1; index++) {
        const { right } = this.data[0];
        const { left } = this.data[0];
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];

        if (element[1] && element[1].lon <= right + 0.000000001) {
          const northingLine = new L.Polyline([element], this.lineOptions);
          // Checks to make sure the northingLine does not go past the left GZD boundary
          if (northingLine.getBounds().getWest() >= left) {
            this.layerGroup100k.addLayer(northingLine);
          }

          // This will "connect" the 100k grid to the GZD. This is useful because not all 100k grids are 100k meters across
          // Convert the Polyline element to a LatLng so we can use the distanceTo() method
          const connectingNorthingLineEast = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
          // If any Polylines are less than 100000 meters away from the GZD, we can then start connecting them
          if (connectingNorthingLineEast.distanceTo({ lat: element[1].lat, lng: right + 0.000000001 }) <= this.gridInterval) {
            const northingGridLineEndpointEast = LLtoUTM({ lat: connectingNorthingLineEast.lat, lon: right + 0.000000001 });
            const extendedLineEast = UTMtoLL({
              northing: Math.round(northingGridLineEndpointEast.northing / this.gridInterval) * this.gridInterval,
              easting: northingGridLineEndpointEast.easting,
              zoneNumber: northingGridLineEndpointEast.zoneNumber,
              zoneLetter: northingGridLineEndpointEast.zoneLetter,
            });
            const connectingNorthingLinetoGZD = new L.Polyline([extendedLineEast, connectingNorthingLineEast], this.lineOptions);
            return this.layerGroup100k.addLayer(connectingNorthingLinetoGZD);
          }

          const connectingNorthingLineWest = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
          if (connectingNorthingLineWest.distanceTo({ lat: element[0].lat, lng: left }) <= this.gridInterval - 1000) {
            const northingGridLineEndpointWest = LLtoUTM({ lat: connectingNorthingLineWest.lat, lon: left });
            const extendedLineWest = UTMtoLL({
              northing: Math.round(northingGridLineEndpointWest.northing / this.gridInterval) * this.gridInterval,
              easting: northingGridLineEndpointWest.easting,
              zoneNumber: northingGridLineEndpointWest.zoneNumber,
              zoneLetter: northingGridLineEndpointWest.zoneLetter,
            });
            const connectingNorthingLinetoGZD = new L.Polyline([extendedLineWest, connectingNorthingLineWest], this.lineOptions);
            // Checks to make sure the connectingNorthingLinetoGZD does not go past the left GZD boundary
            if (connectingNorthingLinetoGZD.getBounds().getWest() >= left) {
              this.layerGroup100k.addLayer(connectingNorthingLinetoGZD);
            }
          }
        }
      }
    });

    // Build the easting grids (I am coloring them blue for easy distinction)
    Object.entries(this.eastingArray).forEach((e) => {
      const bottomNorthing = e[1];
      const bottomRow = this.northingArray.map((j) => [j, bottomNorthing]);
      const emptyBottomRowArr = [];

      bottomRow.forEach((k) => {
        emptyBottomRowArr.push(UTMtoLL({
          northing: k[0].northing,
          easting: k[1].easting,
          zoneNumber: k[0].zoneNumber,
          zoneLetter: k[0].zoneLetter,
        }));
      });

      for (let index = 0; index < emptyBottomRowArr.length; index++) {
        const { right } = this.data[0];
        const { left } = this.data[0];
        const { bottom } = this.data[0];
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];

        // If element[1] exists and if element[1]'s latitude is less than the left boundary and greater than the right boundary
        if (element[1] && element[1].lon >= left && element[1].lon <= right) {
          const eastingLine = new L.Polyline([element], this.lineOptions);

          if (eastingLine.getBounds().getSouth() >= this.south) {
            this.layerGroup100k.addLayer(eastingLine);
          }

          const connectingEastingLine = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
          // If any Polylines are less than 100000 meters away from the GZD, we can then start connecting them
          if (connectingEastingLine.distanceTo({ lat: bottom, lng: element[0].lon }) < this.gridInterval) {
            const eastingGridLineEndpoint = LLtoUTM({ lat: bottom, lon: connectingEastingLine.lng });
            const extendedLineSouth = UTMtoLL({
              northing: Math.round(eastingGridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
              // round the easting so it lines up with the bottom grid.
              easting: Math.round(eastingGridLineEndpoint.easting / this.gridInterval) * this.gridInterval,
              zoneNumber: eastingGridLineEndpoint.zoneNumber,
              zoneLetter: eastingGridLineEndpoint.zoneLetter,
            });

            const connectingEastingLinetoGZD = new L.Polyline([connectingEastingLine, extendedLineSouth], this.lineOptions);

            this.layerGroup100k.addLayer(connectingEastingLinetoGZD);
          }
        }
      }
    });

    // this.clean() will add the layergroup to the map and then clear out the easting/northing arrays
    return this.clean();
  };

  this.clean = function () {
    this.layerGroup100k.addTo(map);
    this.eastingArray = [];
    this.northingArray = [];
  };

  this.regenerate = function () {
    if (this.layerGroup100k) {
      // this.layerGroup100k.eachLayer((layer) => {
      //   if (this.layerGroup100k.hasLayer(layer)) {
      //     console.log('yes');
      //     map.removeLayer(layer);
      //   }
      // });
      setTimeout(() => {
        console.log('run regen');
        this.layerGroup100k.clearLayers();
        return this.getVizGrids();
      }, 200);
    }
  };
}
// Create a new class and give it some boundaries
const generate1000meterGrids = new Grid100K(new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel()));
// Run the class on page load
generate1000meterGrids.getVizGrids();

map.addEventListener('moveend', () => {
  // Clear the grids off the map
  // generate1000meterGrids.regenerate();
  generate1000meterGrids.clean();
  // Run it again
  generate1000meterGrids.getVizGrids();

  setTimeout(() => {
    document.querySelector('.numberOfLayers > .div2').innerHTML = `${document.querySelector('.leaflet-zoom-animated > g').childElementCount}`;
    document.querySelector('.numberOfLayers > .div4').innerHTML = `${map.getZoom()}`;
  }, 300);
}, { once: true });

export { map };
