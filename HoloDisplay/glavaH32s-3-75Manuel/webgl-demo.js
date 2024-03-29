var cubeRotation = 0.0;
let offsX = 0;
let offsY = 0;
let offs = [0, 0];
let rep = 0;
let repLimit = 3;
let ni = 64;
let f = 4;
let rc = 0./2;
let rca = 0;
let ro = 0;
let ofc = 0;
let of = 0;
let step = 1;
let texture;

let inputMessageTexture = "Viking";

var pubnub = new PubNub({
  publishKey: 'pub-c-26a7baf7-1728-44f5-8cbd-2f35c460c8ef',
  subscribeKey: 'sub-c-3a681513-3b09-4143-aa28-a05a3347988c'
});

main();

//
// Start here
//
function toggleFullScreen() {
  var doc = window.document;
  var docEl = doc.documentElement;

  var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    requestFullScreen.call(docEl);
  }
  else {
    cancelFullScreen.call(doc);
  }
}

function main() {
  const canvas = document.querySelector('#glcanvas');
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  const gl = canvas.getContext('webgl');

  pubnub.addListener({
    message: function(m) {
      inputMessageTexture = m.message.text;
      console.log(m.message.text);
    }
  })

  pubnub.subscribe({
    channels: ["msgTest"]
  });

  // If we don't have a GL context, give up now

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  // Vertex shader program

  const vsSource = `
    attribute vec4 aVertexPosition;
    attribute vec2 aTextureCoord;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    varying highp vec2 vTextureCoord;

    void main(void) {
      gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
      //gl_Position =  uModelViewMatrix * aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;

  // Fragment shader program

  const fsSource = `
  precision highp float;
    varying highp vec2 vTextureCoord;

    uniform sampler2D uSampler;
    uniform vec2 offs;
    uniform float ofc;
    uniform float of;
    uniform float ni;
    uniform float f;

    vec2 ind2Cord(float i) {
      float x = f*mod(i, ni/f)/ni;
      float y = 1. - 1./f -floor(f * (i) / ni) / f;
      return vec2(x, -y);
    }

    vec4 readTex(float i, vec2 cord) {
      vec2 offset = ind2Cord(i);
      return texture2D(uSampler, vec2(f * cord[0]/ni, 1. - cord[1] / f) + offset); 
    }

    vec4 blendBetweenStrips(float ind, float fxy) {
      float a;
      float b;
      float ind1;
      float ind2;

      if (fxy > 0.75) {
          a = 1. - clamp((fxy - 0.75)/0.25, 0., 1.) * 0.5;
          ind1 = ind;
          ind2 = ind + 1.;
      } else if (fxy > 0.25) {
          a = 1.;
          ind1 = ind;
          ind2 = ind;
      } else if (fxy > -0.25) {
          a = 0.5 + clamp((fxy)/0.25, -1., 1.) * 0.5;
          ind1 = ind;
          ind2 = ind - 1.;
      } else if (fxy > -0.75) {
          a = 1.;
          ind1 = ind - 1.;
          ind2 = ind - 1.;
      } else {
          a = 1. + clamp((fxy + 0.75)/0.25, -1., 0.) * 0.5;
          ind1 = ind - 1.;
          ind2 = ind - 2.;
      }
      return a * readTex(mod(ind1, ni), vTextureCoord) + (1. - a) * readTex(mod(ind2, ni), vTextureCoord);
    }

    void main(void) {
      float x = vTextureCoord[0];
      float y = vTextureCoord[1];
      
      float i = mod(ni - 1. + floor(mod(((x + ofc) * ni * 0.25), ni)) - of, ni);
      float xp = mod((x + ofc), (4. / ni));
      float yp = y;
      float fxy = xp * ni/4. - 1. + yp;

      /*
      float ind = fxy > 0. ? i : i - 1.; 
      gl_FragColor = readTex(mod(ind, ni), vTextureCoord);
      */
      gl_FragColor = blendBetweenStrips(i, fxy);
      //gl_FragColor = texture2D(uSampler, vec2(vTextureCoord[0]/16., 1. - vTextureCoord[1] * 0.5) + offs);
    }
  `;

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Collect all the info needed to use the shader program.
  // Look up which attributes our shader program is using
  // for aVertexPosition, aTextureCoord and also
  // look up uniform locations.
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
      textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
      offs: gl.getUniformLocation(shaderProgram, "offs"),
      of: gl.getUniformLocation(shaderProgram, "of"),
      ofc: gl.getUniformLocation(shaderProgram, "ofc"),
      ni: gl.getUniformLocation(shaderProgram, "ni"),
      f: gl.getUniformLocation(shaderProgram, "f")
    }
  };

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl);

  const texture1 = loadTexture(gl, 'Holo Babe64.png');
  const texture3 = loadTexture(gl, 'Viking64.png');
  

  var then = 0;

  // Draw the scene repeatedly
  function render(now) {
    now *= 0.001;  // convert to seconds
    const deltaTime = now - then;
    then = now;

    if (inputMessageTexture === "allImgHoloBabe1") {
      texture = texture1;
    } else if (inputMessageTexture === "StarWars1") {
      texture = texture2;
    } else if (inputMessageTexture === "Viking") {
      texture = texture3;
    } else if (inputMessageTexture === "Lighthouse") {
      texture = texture4;
    }

    let prefix = inputMessageTexture.slice(0, 3);
    if (prefix === "RC:") {
      let numberSt = inputMessageTexture.slice(3);
      rc = +numberSt;
    } else if (prefix === "ST:") {
      let numberSt = inputMessageTexture.slice(3);
      step = +numberSt
    } else if (prefix === "SL:") {
      let numberSt = inputMessageTexture.slice(3);
      ro = +numberSt
    } 

    drawScene(gl, programInfo, buffers, texture, deltaTime);

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple three-dimensional cube.
//
function initBuffers(gl) {

  // Create a buffer for the cube's vertex positions.

  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Now create an array of positions for the cube.

  const positions = [
    // Front face
    -0.4, -0.8,  1.0,
     0.4, -0.8,  1.0,
     0.4,  0.8,  1.0,
    -0.4,  0.8,  1.0,
  ];

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  // Now set up the texture coordinates for the faces.

  const textureCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);

  const textureCoordinates = [
    // Front
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex arrays for each face's vertices.

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  const indices = [
    0,  1,  2,      0,  2,  3,    // front
  ];

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices), gl.STATIC_DRAW);

  return {
    position: positionBuffer,
    textureCoord: textureCoordBuffer,
    indices: indexBuffer,
  };
}

//
// Initialize a texture and load an image.
// When the image finished loading copy it into the texture.
//
function loadTexture(gl, url) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Because images have to be download over the internet
  // they might take a moment until they are ready.
  // Until then put a single pixel in the texture so we can
  // use it immediately. When the image has finished downloading
  // we'll update the texture with the contents of the image.
  const level = 0;
  const internalFormat = gl.RGBA;
  const width = 1;
  const height = 1;
  const border = 0;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                width, height, border, srcFormat, srcType,
                pixel);

  const image = new Image();
  image.onload = function() {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  srcFormat, srcType, image);

    // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
       // Yes, it's a power of 2. Generate mips.
       gl.generateMipmap(gl.TEXTURE_2D);
    } else {
       // No, it's not a power of 2. Turn of mips and set
       // wrapping to clamp to edge
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
       gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };
  image.src = url;

  return texture;
}

function isPowerOf2(value) {
  return (value & (value - 1)) == 0;
}

//
// Draw the scene.
//
function drawScene(gl, programInfo, buffers, texture, deltaTime) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Create a perspective matrix, a special matrix that is
  // used to simulate the distortion of perspective in a camera.
  // Our field of view is 45 degrees, with a width/height
  // ratio that matches the display size of the canvas
  // and we only want to see objects between 0.1 units
  // and 100 units away from the camera.

  const fieldOfView = 45 * Math.PI / 180;   // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();

  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(projectionMatrix,
                   fieldOfView,
                   aspect,
                   zNear,
                   zFar);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelViewMatrix = mat4.create();

  // Now move the drawing position a bit to where we want to
  // start drawing the square.

  mat4.translate(modelViewMatrix,     // destination matrix
                 modelViewMatrix,     // matrix to translate
                 [-0.0, 0.0, -3.0]);  // amount to translate
  mat4.rotate(modelViewMatrix,  // destination matrix
              modelViewMatrix,  // matrix to rotate
              cubeRotation*0,     // amount to rotate in radians
              [0, 0, 1]);       // axis to rotate around (Z)
  mat4.rotate(modelViewMatrix,  // destination matrix
              modelViewMatrix,  // matrix to rotate
              cubeRotation * .0,// amount to rotate in radians
              [0, 1, 0]);       // axis to rotate around (X)

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute
  {
    const numComponents = 3;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL how to pull out the texture coordinates from
  // the texture coordinate buffer into the textureCoord attribute.
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
    gl.vertexAttribPointer(
        programInfo.attribLocations.textureCoord,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.textureCoord);
  }

  // Tell WebGL which indices to use to index the vertices
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

  // Tell WebGL to use our program when drawing

  gl.useProgram(programInfo.program);

  // Set the shader uniforms

  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);
  gl.uniform2fv( programInfo.uniformLocations.offs, [offsX, -offsY]);

  gl.uniform1f( programInfo.uniformLocations.of, of);
  gl.uniform1f( programInfo.uniformLocations.ofc, ofc);
  gl.uniform1f( programInfo.uniformLocations.ni, ni);
  gl.uniform1f( programInfo.uniformLocations.f, f);
  

  // Specify the texture to map onto the faces.

  // Tell WebGL we want to affect texture unit 0
  gl.activeTexture(gl.TEXTURE0);

  // Bind the texture to texture unit 0
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Tell the shader we bound the texture to texture unit 0
  gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

  {
    const vertexCount = 6;
    const type = gl.UNSIGNED_SHORT;
    const offset = 0;
    gl.drawElements(gl.TRIANGLES, vertexCount, type, offset);
  }

  // Update the rotation for the next draw

  cubeRotation += deltaTime;

  rca = (rca + rc)%ni;
  ro = ro%ni;
  ofc = (rca + ro)%ni;
  of =  (of + step)%ni;
  
  offsX = offsX === 1. - 1/16 ? 0.: offsX + 1/16;
  if (offsY === 0. && offsX === 0.) {
    offsY = 0.5;
  } else if (offsY === 0.5 && offsX === 0.) {
    offsY = 0.;
  }
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

