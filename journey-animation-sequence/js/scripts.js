import loadEncoder from 'https://unpkg.com/mp4-h264@1.0.7/build/mp4-encoder.js';
import { simd } from "https://unpkg.com/wasm-feature-detect?module";

import flyInAndRotate from "./fly-in-and-rotate.js";
import animatePath from "./animate-path.js";
import animateNearbyCondos from "./animate-nearby-condos.js";


import { createGeoJSONCircle } from './util.js'

const urlSearchParams = new URLSearchParams(window.location.search);
const { gender, stage, square: squareQueryParam, prod: prodQueryParam } = Object.fromEntries(urlSearchParams.entries());

const prod = prodQueryParam === 'true'
const square = squareQueryParam === 'true'

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
  const markers = addPathSourceAndLayer(trackGeoJson)
  const pathSource = addPathLine(trackGeoJson)

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
  const value = await playAnimations(trackGeoJson, markers, pathSource);
  console.log(value, "value")
  console.log("animations played")
  // stop recording
  map.off('render', frame);
  console.log("off rendering")
  mapboxgl.restoreNow();

  // download the encoded video file
  const mp4 = encoder.end();
  console.log("end encoding")

  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([mp4], { type: "video/mp4" }));
  anchor.download = `map_render_example`;
  // anchor.click();
  // console.log("download video")
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const playAnimations = async (trackGeoJson, markers, pathSource) => {
  return new Promise(async (resolve) => {

    let bearing = -20
    let altitude = 12000

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

    markers.forEach((marker)=>{
      marker.togglePopup()
    })

    // Dismount animations and markers in path animation
    await sleep(1500)

    // need to remove layer then source
    map.removeLayer(`${pathSource}-layer`)
    map.removeSource(pathSource)
    markers.forEach((marker) => {
      marker.togglePopup()
    })

    await sleep(1000)

    map.easeTo({
      center: trackGeoJson.geometry.coordinates[0],
      essential: true,
      bearing: 30,
      zoom: 16,
      curve: 1,
      duration: 4000,
      easing(t) {
        return t;
      }
    });

    const condoMarkers = addNearbyCondosSourceAndLayer()
    await animateNearbyCondos({
      duration: 4000,
      condoMarkers
    })

    resolve()
  })
};

const addPathSourceAndLayer = (trackGeojson) => {
  const startGeoJson = {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: trackGeoJson.geometry.coordinates[0]
    },
    properties: {
      title: "Pinnacle @ Duxton",
      description: "Home base",
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Pinnacle%40Duxton%2C_Singapore_-_20100101.jpg"
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
      description : "Place we go to get help",
      imageUrl: "https://thomsonadsett.com/wp-content/uploads/2015/10/NK0128-2-LR1-900x732.jpg"
    }
  }

  const geojsons = [startGeoJson, endGeoJson]
  const markers = []

  geojsons.forEach((feature)=>{
    // create a HTML element for each feature
    const el = document.createElement("div");
    el.className = "marker";
    el.setAttribute("id", feature.properties.title)
    el.style.backgroundImage = "url(" + feature.properties.imageUrl + ")"

    // make a marker for each feature and add to the map
    const marker = new mapboxgl.Marker(el)
      .setLngLat(feature.geometry.coordinates)
      .setPopup(
        new mapboxgl.Popup({ closeButton:false, offset: 25 }) // add popups
          .setHTML(
            `<h3>${feature.properties.title}</h3><p>${feature.properties.description}</p>`
          )
      )
      .addTo(map);
      markers.push(marker)
  })

  return markers
};

const addNearbyCondosSourceAndLayer = () =>{
  const nearbyCondoGeoJson = [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        "marker-size": "small",
        coordinates: [103.84049836517845, 1.2761723395175102]
      },
      properties: {
        title: "The Beacon Condo",
        description: "",
        "marker-size": "small",
        imageUrl: "https://lh5.googleusercontent.com/p/AF1QipP-xQZmqJ61G1FO9ML4ENG85V-ZSzwLNJplpk8i=w408-h306-k-no"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [103.8384717216855, 1.2764555659972008],
      },
      properties: {
        title: "Sky Everton",
        description: "",
        "marker-size": "small",
        imageUrl: "https://lh5.googleusercontent.com/p/AF1QipPadn8s1Lbp34Uq7hGuqo7u6W5p7PDgaUy6w81R=w408-h270-k-no"
      }
    },
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [103.84566013713186, 1.2774852782351251],
      },
      properties: {
        title: "Wallich Residence",
        description: "",
        "marker-size": "small",
        imageUrl: "https://lh5.googleusercontent.com/p/AF1QipNfKaYUZgNo9o7f4ODW1LWOL2RRIX8E2_l539Rp=w408-h544-k-no"
      }
    },
  ]
  const markers = []
  nearbyCondoGeoJson.forEach((feature)=>{
    // create a HTML element for each feature
    const el = document.createElement("div");
    el.className = "marker";
    el.setAttribute("id", feature.properties.title)
    el.style.backgroundImage = "url(" + feature.properties.imageUrl + ")"

    // make a marker for each feature and add to the map
    const marker = new mapboxgl.Marker(el)
      .setLngLat(feature.geometry.coordinates)
      .setPopup(
        new mapboxgl.Popup({ closeButton: false, offset: 25 }) // add popups
          .setHTML(
            `<h3>${feature.properties.title}</h3><p>${feature.properties.description}</p>`
          )
      )
      .addTo(map);
      markers.push(marker)
  })
  return markers
}


const addPathLine = (trackGeojson) => {
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

  return "line"
}