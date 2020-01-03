// Not too much important stuff in here. This is kind of a scratch pad of me figuring things out
import L from 'leaflet';
import * as turf from '@turf/turf';
import {
  forward, getLetterDesignator, inverse, toPoint, get100kSetForZone, get100kID, LLtoUTM, UTMtoLL, decode, encode, UTMtoMGRS,
} from './mgrs';
import { northingDict, eastingDict } from './gzdObject';
import { gz } from './index';
import { map } from './index';

function getPaddingOnZoomLevel100k() {
  if (map.getZoom() >= 17) {
    console.log('high zoom');
    return 3;
  }
  if (map.getZoom() < 17 && map.getZoom() >= 15) {
    console.log('med zoom');
    return 1;
  }
  if (map.getZoom() <= 14 && map.getZoom() >= 12) {
    console.log('low zoom');
    return 0.15;
  }
  return 0.2; // 0.2 seems perfect for zoomlevel 7
}


// https://stackoverflow.com/questions/2218999/remove-duplicates-from-an-array-of-objects-in-javascript
function getUnique(arr, comp) {
  return arr
    .map((e) => e[comp])
    .map((e, i, final) => final.indexOf(e) === i && i) // store the keys of the unique objects
    .filter((e) => arr[e]).map((e) => arr[e]); // eliminate the dead keys & store unique objects
}

// https://stackoverflow.com/questions/54757902/remove-duplicates-in-an-array-using-foreach
function removeDup(arr) {
  const result = [];
  arr.forEach((item, index) => {
    if (arr.indexOf(item) === index) {
      result.push(JSON.parse(item));
    }
  });
  return result;
}


class Gen {
  constructor() {
    this.north = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getNorth();
    this.south = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getSouth();
    this.east = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getEast();
    this.west = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getWest();
    this.empty = [];
    this.uniqueVisibleGrids = {};
    this.eastingArray = [];
    this.northingArray = [];
    this.lineOptions = {
      color: 'green',
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
    this.layerGroup100k = new L.LayerGroup([]);
    this.gridInterval = 100000;
    this.testempty = [];
    return this.getVizGrids();
  }

  // Returns the visible grids on the map and their bounds
  getVizGrids() {
    this.empty.length = 0;
    gz.viz.forEach((visibleGrid) => {
      this.empty.push(visibleGrid);
    });
    this.uniqueVisibleGrids = Object.keys(this.empty).reduce((acc, k) => {
      const grid = this.empty[k].id;
      acc[grid] = acc[grid] || [];
      acc[grid].push(this.empty[k]);
      return acc;
    }, {});
    return this.prepGrids(this.uniqueVisibleGrids);
  }

  prepGrids(uniqueVisibleGrids) {
    this.uniqueVisibleGrids = uniqueVisibleGrids;

    const visibleGridsIterator = new Map(Object.entries(this.uniqueVisibleGrids));

    // Not sure how useful this promise is. It works fine with just a forEach loop
    const delay = (ms) => new Promise(
      (resolve) => setTimeout(resolve, ms),
    );

    visibleGridsIterator.forEach((k) => {
      delay(20)
        .then(() => {
          this.generateGrids(k);
          return delay(3000);
        })
        .catch((err) => {
          console.error(err);
        });
    });
  }

  generateGrids(data) {
    this.data = data;
    Object.values(this.data).forEach((x) => {
      if (x.id) {
        const neLeft = LLtoUTM({ lat: x.top - 0.000001, lon: x.right - 0.000000001 });
        const seLeft = LLtoUTM({ lat: x.bottom, lon: x.right - 0.000000001 });
        const swLeft = LLtoUTM({ lat: x.bottom, lon: x.left });
        let leftEastingIterator = swLeft.easting;
        let leftNorthingIterator = swLeft.northing;

        //* Left Side Easting */
        while (leftEastingIterator <= seLeft.easting) {
          if (leftEastingIterator % this.gridInterval === 0) {
            // this.endCoordNorthing does not change on the easting
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
      // dividing the length by 2 prevents lines from overlapping...idk
      for (let index = 0; index < emptyBottomRowArr.length / 2; index++) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        const { right } = this.data[0];
        const { left } = this.data[0];
        // getUnique() will remove duplicate grid coordinates
        if (getUnique(element, 'lat')[1] && element[1].lon <= right - 0.000000001) {
          const northingLine = new L.Polyline([element], this.lineOptions);
          this.layerGroup100k.addLayer(northingLine);
          // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
          // Convert the Polyline element to a LatLng so we can use the distanceTo() method
          const finalNorthingLine = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
          // If any Polylines are less than 1000 meters away from the GZD, we can then start connecting them
          if (finalNorthingLine.distanceTo({ lat: element[1].lat, lng: right - 0.000000001 }) < this.gridInterval) {
            const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLine.lat, lon: right - 0.000000001 });
            const extendedLine = UTMtoLL({
              northing: Math.round(gridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
              easting: gridLineEndpoint.easting,
              zoneNumber: gridLineEndpoint.zoneNumber,
              zoneLetter: gridLineEndpoint.zoneLetter,
            });
            const northingLinetoGZD = new L.Polyline([extendedLine, finalNorthingLine], this.lineOptions);
            this.layerGroup100k.addLayer(northingLinetoGZD);
          }

          const finalNorthingLine2 = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
          if (finalNorthingLine2.distanceTo({ lat: element[0].lat, lng: left }) < this.gridInterval) {
            const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLine2.lat, lon: left });
            const extendedLine = UTMtoLL({
              northing: Math.round(gridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
              easting: gridLineEndpoint.easting,
              zoneNumber: gridLineEndpoint.zoneNumber,
              zoneLetter: gridLineEndpoint.zoneLetter,
            });
            const northingLinetoGZD = new L.Polyline([extendedLine, finalNorthingLine2], this.lineOptions);
            this.layerGroup100k.addLayer(northingLinetoGZD);
          }
        }
      }
    });

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
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];

        // returning 3320 children
        // childcount is now 1420 with testempty
        if (element[1] && element[1].lon >= eastingDict[bottomRow[index][1].zoneNumber].left) {
          // const fuck0 = map.latLngToLayerPoint(element[0]);
          // const fuck1 = map.latLngToLayerPoint(element[1]);


          // this.testempty.push(JSON.stringify(element));


          if (emptyBottomRowArr[index + 2]) {
            const myline = new L.point(map.latLngToLayerPoint(emptyBottomRowArr[index]));
            const myline2 = new L.point(map.latLngToLayerPoint(emptyBottomRowArr[index + 1]));
            const myline3 = new L.point(map.latLngToLayerPoint(emptyBottomRowArr[index + 2]));
            if (L.LineUtil.closestPointOnSegment(myline, myline2, myline3).distanceTo(myline) < 870) {
              const finalNorthingLine2 = new L.latLng({ lat: northingDict[bottomRow[index][1].zoneLetter].bottom, lng: element[1].lon });
              if (finalNorthingLine2.distanceTo(element[1]) < 1000000) {
                this.testempty.push(JSON.stringify(element));
              }
            }
          }
        }


        // if (element[1] && element[1].lat <= this.south) {
        //   const eastingLine = new L.Polyline([element], {
        //     color: 'blue',
        //     weight: 4,
        //     opacity: 0.5,
        //     interactive: false,
        //     fill: false,
        //     noClip: true,
        //     smoothFactor: 4,
        //     lineCap: 'butt',
        //     lineJoin: 'miter-clip',
        //   });
        //   this.layerGroup100k.addLayer(eastingLine);
        // }
      }
    });

    // testempty is 1905 arrays
    const newEastlingLine = removeDup(this.testempty);


    const eastingLine = new L.Polyline([newEastlingLine], {
      color: 'blue',
      weight: 4,
      opacity: 0.9,
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
      className: 'bluegoo',
    });

    this.layerGroup100k.addLayer(eastingLine);


    return this.clean();
  }

  clean() {
    // dump the array vals and prepare for next grid
    console.log('cleaning ');


    this.layerGroup100k.addTo(map);
    this.eastingArray = [];
    this.northingArray = [];
    this.testempty = [];
  }
}

setTimeout(() => {
  // const p = new Gen();
  // window.p = p;
}, 300);
window.getUnique = getUnique;
window.Gen = Gen;
//! 100k


function Grid100k() {
  this.constructor = function () {
    this.north = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getNorth();
    this.south = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getSouth();
    this.east = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getEast();
    this.west = new L.latLngBounds(map.getBounds()).pad(getPaddingOnZoomLevel100k()).getWest();
    this.eastingArray = [];
    this.northingArray = [];
    this.lineOptions = {
      color: 'orange',
      weight: 5,
      opacity: 0.5,
      interactive: false,
      fill: false,
      noClip: true,
      smoothFactor: 4,
      lineCap: 'butt',
      lineJoin: 'miter-clip',
    };
    this.map = map;
    this.layerGroup100k = new L.LayerGroup([]);
    //! I am wondering if we set the grid interval to 1mil, 100k, 1000m then we could keep all the grid functionality within 1 function/class
    this.gridInterval = 100000;
    return this;
  };

  this.determineGrids = function () {
    this.constructor();
    const empty = [];
    gz.viz.forEach((visibleGrid) => {
      //! You might be on to something right here.
      //! since the map is currently displaying a left, right and MIDDLE grid, the middle one is skipped over
      //! This loop gets the topLeft/topRight/bottomRight of every single visible GZD since it is calling the "gz" variable from the GZD class
      //! iterate through all of them and then you'll have a semi-working product that you can document for help
      // const topLeft = new L.LatLng(u.top, u.left);
      // const topRight = new L.LatLng(u.top, u.right);
      // const bottomRight = new L.LatLng(u.bottom, u.right);
      const bottomLeft = new L.LatLng(visibleGrid.bottom, visibleGrid.left);
      const visibleGridObject = {
        tl: {
          ll: new L.LatLng(visibleGrid.top, visibleGrid.left),
          utm: LLtoUTM({ lat: visibleGrid.top, lon: visibleGrid.left }),
        },
        tr: {
          ll: new L.LatLng(visibleGrid.top, visibleGrid.right),
          utm: LLtoUTM({ lat: visibleGrid.top, lon: visibleGrid.right }),
        },
        br: {
          ll: new L.LatLng(visibleGrid.bottom, visibleGrid.right),
          utm: LLtoUTM({ lat: visibleGrid.bottom, lon: visibleGrid.right }),
        },
        bl: {
          ll: new L.LatLng(visibleGrid.bottom, visibleGrid.left),
          utm: LLtoUTM({ lat: visibleGrid.bottom, lon: visibleGrid.left }),
        },
      };
      empty.push(visibleGrid);
    });
    // Object key-value map reversal https://www.freecodecamp.org/news/15-useful-javascript-examples-of-map-reduce-and-filter-74cbbb5e0a1f/
    const uniqueVisibleGrids = Object.keys(empty).reduce((acc, k) => {
      const grid = empty[k].id;
      acc[grid] = acc[grid] || [];

      acc[grid].push(empty[k]);
      return acc;
    }, {});


    setTimeout(() => {
      const NWBounds1 = LLtoUTM({ lat: this.constructor().north, lon: this.constructor().west });
      const NWBounds2 = LLtoUTM({ lat: uniqueVisibleGrids['18'][0].top, lon: uniqueVisibleGrids['18'][0].left });
      // console.log(this.constructor().north, this.constructor().west);
      // console.log('*****************');
      // console.log(uniqueVisibleGrids['18'][0].top, uniqueVisibleGrids['18'][0].left);
      // Create the latLngBounds of the visible area (with padding)
      const SWBounds1 = LLtoUTM({ lat: this.constructor().south, lon: this.constructor().west });
      const NEBounds1 = LLtoUTM({ lat: this.constructor().north, lon: this.constructor().east });
      const llbs = L.latLngBounds([this.constructor().south, this.constructor().west], [this.constructor().north, this.constructor().east]);
      const farWestLng = llbs.getWest();
      const farEastLng = llbs.getEast();
      const farNorthLat = llbs.getNorth();
      const farSouthLat = llbs.getSouth();

      // console.log('Left:', farWestLng);
      // console.log('Right:', farEastLng);
      // console.log('Top:', farNorthLat);
      // console.log('Bottom:', farSouthLat);
      // create latlngbounds of the returned grids

      // eslint-disable-next-line no-var

      Object.values(uniqueVisibleGrids).forEach((grid) => {
        const element = grid;
        // console.log(element);
        element.flatMap((x) => {
          if (farWestLng < x.left && farEastLng > x.right) {
            if (farNorthLat < x.top) {
              const NEBoundsTop = LLtoUTM({ lat: this.constructor().north, lon: x.left });
              L.marker({ lat: this.constructor().north, lon: x.right - 0.0000001 }).addTo(map);

              this.eastingArray = [];
              this.northingArray = [];
              const neLeft = LLtoUTM({ lat: this.constructor().north, lon: x.right - 0.000000001 });
              const seLeft = LLtoUTM({ lat: this.constructor().south, lon: x.right - 0.000000001 });
              const swLeft = LLtoUTM({ lat: this.constructor().south, lon: x.left });

              let leftEastingIterator = swLeft.easting;
              let leftNorthingIterator = swLeft.northing;

              //* Left Side Easting */
              while (leftEastingIterator <= seLeft.easting) {
                if (leftEastingIterator % this.gridInterval === 0) {
                  // this.endCoordNorthing does not change on the easting
                  this.eastingArray.push({
                    easting: leftEastingIterator,
                    zoneNumber: seLeft.zoneNumber,
                    zoneLetter: seLeft.zoneLetter,
                  });
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
                }
                leftNorthingIterator += 1;
              }

              return this.generateSplitGrids('right', NEBoundsTop);
            }
            if (farSouthLat > x.bottom) {
              const NEBoundsBottom = LLtoUTM({ lat: this.constructor().south, lon: x.right - 0.0000001 });
              L.marker({ lat: this.constructor().south, lon: x.right - 0.0000001 }).addTo(map);
            }
          }
        });
      });
    }, 300);


    // Do not add 1000 meter grids if the zoom level is <= 12
    // if (map.getZoom() <= 12) { return; }

    const NEBounds = LLtoUTM({ lat: this.constructor().north, lon: this.constructor().east });
    const NWBounds = LLtoUTM({ lat: this.constructor().north, lon: this.constructor().west });
    const SEBounds = LLtoUTM({ lat: this.constructor().south, lon: this.constructor().east });
    const SWBounds = LLtoUTM({ lat: this.constructor().south, lon: this.constructor().west });

    let noAdjacentGZD = false;
    if (NEBounds.zoneNumber === NWBounds.zoneNumber || SEBounds.zoneNumber === SWBounds.zoneNumber) {
      // Since there are no GZDs that are splitting the map bounds, we only need to run one "side"
      return this.right(NEBounds, noAdjacentGZD = true);
    }
    const leftPromise = new Promise((resolve) => {
      // console.log(NWBounds);
      resolve(this.left(NWBounds));
    });
    Promise.all([leftPromise]).then(() => new Promise((resolve) => {
      // Clear out the arrays so the right side can generate grids
      this.eastingArray = [];
      this.northingArray = [];
      setTimeout(() => resolve(this.right(NEBounds)), 10);
    }));
  };


  this.left = function (NWBounds) {
    const neLeft = LLtoUTM({ lat: this.north, lon: eastingDict[NWBounds.zoneNumber].right - 0.000000001 });
    const seLeft = LLtoUTM({ lat: this.south, lon: eastingDict[NWBounds.zoneNumber].right - 0.000000001 });
    const swLeft = LLtoUTM({ lat: this.south, lon: this.west });

    let leftEastingIterator = swLeft.easting;
    let leftNorthingIterator = swLeft.northing;

    //* Left Side Easting */
    while (leftEastingIterator <= seLeft.easting) {
      if (leftEastingIterator % this.gridInterval === 0) {
        // this.endCoordNorthing does not change on the easting
        this.eastingArray.push({
          easting: leftEastingIterator,
          zoneNumber: seLeft.zoneNumber,
          zoneLetter: seLeft.zoneLetter,
        });
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
      }
      leftNorthingIterator += 1;
    }

    return this.generateSplitGrids('left', NWBounds);
  };


  this.right = function (NEBounds, noAdjacentGZD = false) {
    let swRight;
    if (noAdjacentGZD) {
      swRight = LLtoUTM({ lat: this.south, lon: this.west });
    } else {
      swRight = LLtoUTM({ lat: this.south, lon: eastingDict[NEBounds.zoneNumber].left });
    }

    const neRight = LLtoUTM({ lat: this.north, lon: this.east });
    const seRight = LLtoUTM({ lat: this.south, lon: this.east });
    let rightEastingIterator = swRight.easting;
    let rightNorthingIterator = swRight.northing;

    //* Right Side Easting */
    while (rightEastingIterator <= seRight.easting) {
      if (rightEastingIterator % this.gridInterval === 0) {
        this.eastingArray.push({
          easting: rightEastingIterator,
          zoneNumber: seRight.zoneNumber,
          zoneLetter: seRight.zoneLetter,
        });
      }
      rightEastingIterator += 1;
    }
    // https://stackoverflow.com/questions/9229645/remove-duplicate-values-from-js-array
    // Good info on how to remove duplicates

    //* Right Side Northing */
    while (rightNorthingIterator <= neRight.northing) {
      if (rightNorthingIterator % this.gridInterval === 0) {
        this.northingArray.push({
          northing: rightNorthingIterator,
          zoneNumber: neRight.zoneNumber,
          zoneLetter: neRight.zoneLetter,
        });
      }
      rightNorthingIterator += 1;
    }
    return this.generateSplitGrids('right', NEBounds);
  };


  this.generateSplitGrids = function (direction, bounds) {
    this.direction = direction;
    this.bounds = bounds;

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

      for (let index = 0; index < emptyBottomRowArr.length; index++) {
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];
        switch (this.direction) {
          case 'left':
            // element[1] ensures that each element in the loop has 2 arrays. If there is only 1 array then it's the "odd-man-out" so we disregard it
            // element[1].lon <= eastingDict[NWBounds.zoneNumber].right - 0.000000001 ensures that the lines will not go over the GZD boundaries
            if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
              const northingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup100k.addLayer(northingLine);
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              const finalNorthingLine = new L.latLng({ lat: element[1].lat, lng: element[1].lon });
              // If any Polylines are less than 1000 meters away from the GZD, we can then start connecting them
              if (finalNorthingLine.distanceTo({ lat: element[1].lat, lng: eastingDict[this.bounds.zoneNumber].right - 0.000000001 }) < this.gridInterval) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLine.lat, lon: eastingDict[this.bounds.zoneNumber].right - 0.000000001 });

                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });

                const northingLinetoGZD = new L.Polyline([extendedLine, finalNorthingLine], this.lineOptions);
                this.layerGroup100k.addLayer(northingLinetoGZD);
              }
            }
            break;
          case 'right':
            if (element[1] && element[0].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const northingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup100k.addLayer(northingLine);
              // Since element[0] starts on the left, we use that to test if the polyline is extending over the GZD bounds
              const finalNorthingLine = new L.latLng({ lat: element[0].lat, lng: element[0].lon });
              // This will "connect" the 1000m grid to the GZD. This is useful because not all 1000m grids...are 1000m
              // Convert the Polyline element to a LatLng so we can use the distanceTo() method
              // console.log(finalNorthingLine.distanceTo({ lat: element[0].lat, lng: eastingDict[this.bounds.zoneNumber].left }));
              if (finalNorthingLine.distanceTo({ lat: element[0].lat, lng: eastingDict[this.bounds.zoneNumber].left }) < this.gridInterval) {
                const gridLineEndpoint = LLtoUTM({ lat: finalNorthingLine.lat, lon: eastingDict[this.bounds.zoneNumber].left });
                const extendedLine = UTMtoLL({
                  northing: Math.round(gridLineEndpoint.northing / this.gridInterval) * this.gridInterval,
                  easting: gridLineEndpoint.easting,
                  zoneNumber: gridLineEndpoint.zoneNumber,
                  zoneLetter: gridLineEndpoint.zoneLetter,
                });
                const northingLinetoGZD = new L.Polyline([extendedLine, finalNorthingLine], this.lineOptions);
                this.layerGroup100k.addLayer(northingLinetoGZD);
              }
            }
            break;
          default:
            break;
        }
      }
    });

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
        const element = [emptyBottomRowArr[index], emptyBottomRowArr[index + 1]];

        switch (this.direction) {
          case 'left':
            if (element[1] && element[1].lon <= eastingDict[this.bounds.zoneNumber].right - 0.000000001) {
              const eastingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup100k.addLayer(eastingLine);
            }
            break;
          case 'right':
            if (element[1] && element[1].lon >= eastingDict[this.bounds.zoneNumber].left) {
              const eastingLine = new L.Polyline([element], this.lineOptions);
              this.layerGroup100k.addLayer(eastingLine);
            }
            break;
          default:
            break;
        }
      }
    });
    // All the Polylines are now in this group, we can add it to the map
    this.layerGroup100k.addTo(this.map);
    return this;
  };

  this.clean = function () {
    if (this.layerGroup100k) {
      this.map.removeLayer(this.layerGroup100k);
    }
  };
}

export default Grid100k;
