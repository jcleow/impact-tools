import loadEncoder from 'https://unpkg.com/mp4-h264@1.0.7/build/mp4-encoder.js';
import { simd } from "https://unpkg.com/wasm-feature-detect?module";

import flyInAndRotate from "./fly-in-and-rotate.js";
import animatePath from "./animate-path.js";


import { createGeoJSONCircle } from './util.js'

const urlSearchParams = new URLSearchParams(window.location.search);
const { gender, stage, square: squareQueryParam, prod: prodQueryParam } = Object.fromEntries(urlSearchParams.entries());

const prod = prodQueryParam === 'true'
const square = squareQueryParam === 'true'

// if (square) {
//   document.getElementById("map").style.height = '1080px';
//   document.getElementById("map").style.width = '1080px';
// }

mapboxgl.accessToken =
  "pk.eyJ1IjoiY2hyaXN3aG9uZ21hcGJveCIsImEiOiJjbDR5OTNyY2cxZGg1M2luejcxZmJpaG1yIn0.mUZ2xk8CLeBFotkPvPJHGg";

const start = [103.8412, 1.2769];
const end = [103.8348, 1.2806]

const query = await fetch(
  `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
  { method: "GET" }
);
const json = await query.json();
const geometries = json.routes[0].geometry;
const trackGeoJson = {
  type: "Feature",
  properties: {},
  geometry: geometries
}
console.log(trackGeoJson, "trackGeoJson")
console.log(typeof(trackGeoJson), "type of trackGeoJson")

const bounds = turf.bbox(trackGeoJson)

const map = window.map = new mapboxgl.Map({
  container: "map",
  projection: "globe",
  style: "mapbox://styles/mapbox/light-v10", // Specify which map style to use
  // style: 'mapbox://styles/mapbox/satellite-v9',
  zoom: 14.5,
  center:{lng: 103.8412, lat: 1.2769},
  pitch: 30,
  bearing: 0,
});

// Immediately animate to the fitted boundary
map.fitBounds(bounds, {
  duration: 3000,
  pitch: 30,
  bearing: 0,
  padding: 200,
  maxZoom: 16,
});


map.on("load", async () => {
  // add 3d, sky and fog
  // add3D();
  addPathSourceAndLayer(trackGeoJson)

  await map.once('idle');

  // don't forget to enable WebAssembly SIMD in chrome://flags for faster encoding
  const supportsSIMD = await simd();

  // initialize H264 video encoder
  const Encoder = await loadEncoder({simd: supportsSIMD});

  const gl = map.painter.context.gl;
  const width = gl.drawingBufferWidth;
  const height = gl.drawingBufferHeight;

  const encoder = Encoder.create({
      width,
      height,
      fps: 60,
      kbps: 64000,
      rgbFlipY: true
  });

  // stub performance.now for deterministic rendering per-frame (only available in dev build)
  let now = performance.now();
  mapboxgl.setNow(now);

  const ptr = encoder.getRGBPointer(); // keep a pointer to encoder WebAssembly heap memory

  function frame() {
      // increment stub time by 16.6ms (60 fps)
      now += 1000 / 60;
      mapboxgl.setNow(now);

      const pixels = encoder.memory().subarray(ptr); // get a view into encoder memory
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); // read pixels into encoder
      encoder.encodeRGBPointer(); // encode the frame
  }

  map.on('render', frame); // set up frame-by-frame recording


  // kick off the animations
  await playAnimations(trackGeoJson);

  // stop recording
  map.off('render', frame);
  mapboxgl.restoreNow();

  // download the encoded video file
  const mp4 = encoder.end();
  console.log(mp4, "mp4")
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([mp4], { type: "video/mp4" }));
  anchor.download = `map_render_example`;
  anchor.click();

});

const add3D = () => {
  // add map 3d terrain and sky layer and fog
  // Add some fog in the background
  map.setFog({
    range: [0.5, 10],
    color: "white",
    "horizon-blend": 0.2,
  });

  // Add a sky layer over the horizon
  map.addLayer({
    id: "sky",
    type: "sky",
    paint: {
      "sky-type": "atmosphere",
      "sky-atmosphere-color": "rgba(85, 151, 210, 0.5)",
    },
  });

  // // Add terrain source, with slight exaggeration
  // map.addSource("mapbox-dem", {
  //   type: "raster-dem",
  //   url: "mapbox://mapbox.terrain-rgb",
  //   tileSize: 512,
  //   maxzoom: 14,
  // });
  // map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });
};

const playAnimations = async (trackGeoJson) => {
  return new Promise(async (resolve) => {

    // add a geojson source and layer for the linestring to the map
    // addPathSourceAndLayer(trackGeojson);

    // get the start of the linestring, to be used for animating a zoom-in from high altitude
    // var targetLngLat = {
    //   lng: trackGeojson.geometry.coordinates[0][0],
    //   lat: trackGeojson.geometry.coordinates[0][1],
    // };

    // animate zooming in to the start point, get the final bearing and altitude for use in the next animation
    // const { bearing, altitude } = await flyInAndRotate({
    //   map,
    //   targetLngLat,
    //   duration: prod ? 7000 : 5000,
    //   startAltitude: 1000000,
    //   endAltitude: 12000,
    //   startBearing: 0,
    //   endBearing: -20,
    //   startPitch: 40,
    //   endPitch: 50,
    //   prod
    // });

    const bearing = -20
    const altitude = 12000

    // follow the path while slowly rotating the camera, passing in the camera bearing and altitude from the previous animation
    await animatePath({
      map,
      duration: prod ? 4000 : 2000,
      path: trackGeoJson,
      startBearing: bearing,
      startAltitude: altitude,
      pitch: 50,
      prod,
      trackGeoJson
    });

    // get the bounds of the linestring, use fitBounds() to animate to a final view
    // const bounds = turf.bbox(trackGeojson);
    // map.fitBounds(bounds, {
    //   duration: 3000,
    //   pitch: 30,
    //   bearing: 0,
    //   padding: 120,
    //   maxZoom: 15,
    // });

    setTimeout(() => {
      resolve()
    }, 10)

  })
};





const addPathSourceAndLayer = (trackGeojson) => {
  console.log("add path first")
  const startGeoJson = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: trackGeoJson.geometry.coordinates[0]
    },
    properties: {
      title: "Pinnacle @ Duxton",
      description: "Home base"
    }
  }

  const endGeoJson = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: trackGeoJson.geometry.coordinates.slice(-1)[0]
    },
    properties: {
      title: "Singapore General Hospital",
      description : "Place we go to get help"
    }
  }

  console.log(startGeoJson, 'startGeoJson')
  console.log(endGeoJson, 'endGeoJson')

  map.loadImage(
    'https://docs.mapbox.com/mapbox-gl-js/assets/custom_marker.png',
    (error, image) => {
      if (error) {
        console.log(error, "error")
        throw error;
      }
      map.addImage('custom-marker', image);
      map.addSource('points', {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [startGeoJson, endGeoJson]
        }
      })
      // Add a symbol layer
      map.addLayer({
        'id': 'points',
        'type': 'symbol',
        'source': 'points',
        'layout': {
        'icon-image': 'custom-marker',
        // get the title name from the source's "title" property
        'text-field': ['get', 'title'],
        'text-font': [
        'Open Sans Semibold',
        'Arial Unicode MS Bold'
        ],
        'text-offset': [0, 1.25],
        'text-anchor': 'top'
        }
      });
    }
  );



  // Add a line feature and layer. This feature will get updated as we progress the animation
  map.addSource("line", {
    type: "geojson",
    // Line metrics is required to use the 'line-progress' property
    lineMetrics: true,
    data: trackGeojson,
  });
  map.addLayer({
    id: "line-layer",
    type: "line",
    source: "line",
    paint: {
      "line-color": "rgba(0,0,0,0)",
      "line-width": 9,
      "line-opacity": 0.8,
    },
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
  });

  // map.addSource("start-pin-base", {
  //   type: "geojson",
  //   data: createGeoJSONCircle(trackGeojson.geometry.coordinates[0], 0.01)
  // });

  // map.addSource("start-pin-top", {
  //   type: "geojson",
  //   data: createGeoJSONCircle(trackGeojson.geometry.coordinates[0], 0.01)
  // });

  // map.addSource("end-pin-base", {
  //   type: "geojson",
  //   data: createGeoJSONCircle(trackGeojson.geometry.coordinates.slice(-1)[0], 0.01)
  // });

  // map.addSource("end-pin-top", {
  //   type: "geojson",
  //   data: createGeoJSONCircle(trackGeojson.geometry.coordinates.slice(-1)[0], 0.01)
  // });

  // map.addLayer({
  //   id: "start-fill-pin-base",
  //   type: "fill-extrusion",
  //   source: "start-pin-base",
  //   paint: {
  //     'fill-extrusion-color': '#0bfc03',
  //     'fill-extrusion-height': 100
  //   }
  // });
  // map.addLayer({
  //   id: "start-fill-pin-top",
  //   type: "fill-extrusion",
  //   source: "start-pin-top",
  //   paint: {
  //     'fill-extrusion-color': '#0bfc03',
  //     'fill-extrusion-base': 1000,
  //     'fill-extrusion-height': 100
  //   }
  // });

  // map.addLayer({
  //   id: "end-fill-pin-base",
  //   type: "fill-extrusion",
  //   source: "end-pin-base",
  //   paint: {
  //     'fill-extrusion-color': '#eb1c1c',
  //     'fill-extrusion-height': 100
  //   }
  // });
  // map.addLayer({
  //   id: "end-fill-pin-top",
  //   type: "fill-extrusion",
  //   source: "end-pin-top",
  //   paint: {
  //     'fill-extrusion-color': '#eb1c1c',
  //     'fill-extrusion-base': 1000,
  //     'fill-extrusion-height': 1200
  //   }
  // });


};

