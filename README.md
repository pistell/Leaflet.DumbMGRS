# Leaflet.DumbMGRS

An MGRS grid overlay plugin for your leaflet application. This plugin will enable you to display the Grid Zone Designators (1 million meters by 1 million meters), the 100K grid zones, and a 1000 meter grid interval 😎

![screenshot](./src/img/screenshot_27JAN_2.png)

![screenshot](./src/img/4square.jpg)

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

## Overview

I am trying to generate 3 types of grids

1. A Grid Zone Designator - 1 million by 1 million meter grid. The GZD is outlined in red and has a grid label in the center of it. This actually works as I intended it to. See class GZD in index.js for the code.

2. A 100K grid - 100k by 100k meter grid. This is filled with bugs and inefficient code.

3. A 1000M grid - 1000m by 1000m grid.

## Issues

1. Need to come up with a method that toggles grid labels on and off

2. 100K grids fail around Antarctica

3. 100K grid labels collide with each other when they start converging near the grid zone designator boundaries

4. 100K grids fail on GZD 31U,31V and 32V (These are the "special" case grid zones)

5. 100K grids in GZD 31U does not work when the GZDs to the north of it are in visible range

6. 1000m grids are all kinda jacked up in the southern hemisphere.

## Other Stuff

Readme created with [createapp.dev](https://createapp.dev/)

[Leaflet publishing guide](https://github.com/Leaflet/Leaflet/blob/master/PLUGIN-GUIDE.md)
