# Leaflet.DumbMGRS

An MGRS grid overlay plugin for your leaflet application... But dumber!

## Do not use this in production, this is incomplete

To install, clone the repo

```sh
git clone https://github.com/pistell/Leaflet.DumbMGRS.git
```

Install dependencies:

```sh
npm install
```

To run in hot module reloading mode (uses Parcel):

```sh
npm start
```

To create a production build:

```sh
npm run build-prod
```

Parcel will watch for any changes in the /src/ folder and automatically reload

## Running

```sh
node dist/bundle.js
```

## Issues

I am trying to generate 3 types of grids

1. A Grid Zone Designator - 1 million by 1 million meter grid. The GZD is outlined in red and has a grid label in the center of it. This actually works as I intended it to.
2. A 100K grid - 100k by 100k meter grid. This works on page load but when the user moves the map the old grids stay on the map and it slows the browser down. Try scrolling around the map and look at the info bar at the bottom. The "Number of layers on Map" keeps increasing. The out of bounds grids are not getting deleted. There are other issues with this like certain grid lines just not even drawing on the map. This is where I am stuck. Ideally I would like to add grid labels to these ones because they are large enough to hold one

3. A 1000M grid - 1000m by 1000m grid. I have a working version of this in the grid1000meters.js file. These grids should not be shown unless the user is at a specific zoom level.

## Other Stuff

Readme created with [createapp.dev](https://createapp.dev/)

[Leaflet publishing guide](https://github.com/Leaflet/Leaflet/blob/master/PLUGIN-GUIDE.md)
