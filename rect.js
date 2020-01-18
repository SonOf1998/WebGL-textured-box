const VertexShaderString = `
    precision mediump float;

    attribute vec3 position;
    attribute vec3 normal;
    attribute vec2 tex;

    uniform mat4 P;
    uniform mat4 M;

    varying vec2 transfer_tex;
    varying vec3 transfer_normal;

    void main()
    {
        transfer_tex = tex;
        transfer_normal = normal;

        gl_Position = P * M * vec4(position, 1);
    }
`

const FragmentShaderString = `
    precision mediump float;

    uniform sampler2D sampler;
    uniform mat4 N;                             // Normál mátrix, non-uniform scalinghez...
                                                // Érdemes CPU-n kiszámoltatni

    varying vec2 transfer_tex;
    varying vec3 transfer_normal;

    void main()
    {
        vec3 n = vec4(N * vec4(transfer_normal, 0)).xyz;

        vec4 color = texture2D(sampler, transfer_tex);

        vec3 ambient = vec3(0.3, 0.3, 0.3);

        vec3 directionalLightColor = vec3(1, 1, 1);        
        vec3 directDir = normalize(vec3(1, 1, 0));

        float diffCoeff = max(dot(n, directDir), 0.0);
        vec3 diffuse = diffCoeff * directionalLightColor;



        gl_FragColor = vec4((ambient + diffuse) * color.rgb, 1);
    }
`

/** @type {WebGLRenderingContext} */
var gl;

var VBO;
var IBO;

var GPUProgram;
var M;
var N;

function loadShader(type, shaderScrCode)
{
    const shader = gl.createShader(type);  
  
    gl.shaderSource(shader, shaderScrCode);  
    gl.compileShader(shader);
  
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) 
    {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
  
    return shader;
}

function initShaders()
{
    const vertexShader = loadShader(gl.VERTEX_SHADER, VertexShaderString);
    const fragmentShader = loadShader(gl.FRAGMENT_SHADER, FragmentShaderString);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);


    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) 
    {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }


    return shaderProgram;
}




function loadTexture(url)
{
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));


    var isOnPowerOfTwo = i => { (i & (i - 1)) == 0; } 

    let image = new Image();
    image.src = url;
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

        if (isOnPowerOfTwo(image.width) && isOnPowerOfTwo(image.height))
        {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
        else
        {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    }
    
    return texture;
}



// onInit OpenGL függvény megfelelője
function initWebGL()
{
    const canvas = document.querySelector("#screen");
    gl = canvas.getContext("webgl");

    if (!gl)
    {
        alert("WebGL is supported restrictedly or not at all!");
        return;
    }

    const shaderProgram = initShaders();
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    GPUProgram = 
    {
        program : shaderProgram,

        attribLocations : {
            vertexPos   : gl.getAttribLocation(shaderProgram, "position"),
            normals     : gl.getAttribLocation(shaderProgram, "normal"),
            textCoord   : gl.getAttribLocation(shaderProgram, "tex"),
            //vertexColor : gl.getAttribLocation(shaderProgram, "color"),
        },

        uniformLocation : {
            P : gl.getUniformLocation(shaderProgram, "P"),
            M : gl.getUniformLocation(shaderProgram, "M"),
            N : gl.getUniformLocation(shaderProgram, "N"),
            sampler : gl.getUniformLocation(shaderProgram, "sampler"),
        },
    }
    gl.useProgram(shaderProgram);


    const cubeVertices = [
    //    X     Y    Z       NX    NY    NZ     U     V

        // Front face
        -1.0, -1.0,  1.0,   0.0,  0.0,  1.0,   0.0,  0.0,
         1.0, -1.0,  1.0,   0.0,  0.0,  1.0,   1.0,  0.0,
         1.0,  1.0,  1.0,   0.0,  0.0,  1.0,   1.0,  1.0,
        -1.0,  1.0,  1.0,   0.0,  0.0,  1.0,   0.0,  1.0,
        
        // Back face
        -1.0, -1.0, -1.0,   0.0,  0.0, -1.0,   0.0,  0.0,
        -1.0,  1.0, -1.0,   0.0,  0.0, -1.0,   1.0,  0.0, 
         1.0,  1.0, -1.0,   0.0,  0.0, -1.0,   1.0,  1.0, 
         1.0, -1.0, -1.0,   0.0,  0.0, -1.0,   0.0,  1.0, 
        
        // Top face
        -1.0,  1.0, -1.0,   0.0,  1.0,  0.0,   0.0,  0.0,
        -1.0,  1.0,  1.0,   0.0,  1.0,  0.0,   1.0,  0.0, 
         1.0,  1.0,  1.0,   0.0,  1.0,  0.0,   1.0,  1.0, 
         1.0,  1.0, -1.0,   0.0,  1.0,  0.0,   0.0,  1.0, 
        
        // Bottom face
        -1.0, -1.0, -1.0,   0.0, -1.0,  0.0,   0.0,  0.0, 
         1.0, -1.0, -1.0,   0.0, -1.0,  0.0,   1.0,  0.0,  
         1.0, -1.0,  1.0,   0.0, -1.0,  0.0,   1.0,  1.0,  
        -1.0, -1.0,  1.0,   0.0, -1.0,  0.0,   0.0,  1.0,  
        
        // Right face
         1.0, -1.0, -1.0,   1.0,  0.0,  0.0,   0.0,  0.0, 
         1.0,  1.0, -1.0,   1.0,  0.0,  0.0,   1.0,  0.0,  
         1.0,  1.0,  1.0,   1.0,  0.0,  0.0,   1.0,  1.0,  
         1.0, -1.0,  1.0,   1.0,  0.0,  0.0,   0.0,  1.0,  
        
        // Left face
        -1.0, -1.0, -1.0,   -1.0, 0.0,  0.0,   0.0,  0.0,  
        -1.0, -1.0,  1.0,   -1.0, 0.0,  0.0,   1.0,  0.0,   
        -1.0,  1.0,  1.0,   -1.0, 0.0,  0.0,   1.0,  1.0,   
        -1.0,  1.0, -1.0,   -1.0, 0.0,  0.0,   0.0,  1.0,   
    ];

    const indices = [
        0,  1,  2,      0,  2,  3,    // front
        4,  5,  6,      4,  6,  7,    // back
        8,  9,  10,     8,  10, 11,   // top
        12, 13, 14,     12, 14, 15,   // bottom
        16, 17, 18,     16, 18, 19,   // right
        20, 21, 22,     20, 22, 23,   // left
    ];

    // http://127.0.0.1:8080
    // python -m http.server 8080 --bind 127.0.0. 

    const texture = loadTexture('box.png');


    IBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, IBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);


    VBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cubeVertices), gl.STATIC_DRAW)

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(GPUProgram.uniformLocation.sampler, 0);

    const fov = 45 * Math.PI / 180;
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;

    // uniform mátrixok //
    M = mat4.create();
    const P = mat4.create();
    N = mat4.create();
    mat4.invert(N, M);
    mat4.transpose(N, N);
    //////////////////////

    mat4.perspective(P, fov, aspect, zNear, zFar);
    mat4.translate(M, M, [0.0, 0.0, -6.0]);


    gl.enableVertexAttribArray(GPUProgram.attribLocations.vertexPos);
    gl.vertexAttribPointer(GPUProgram.attribLocations.vertexPos, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(GPUProgram.attribLocations.normals);
    gl.vertexAttribPointer(GPUProgram.attribLocations.normals, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(GPUProgram.attribLocations.textCoord);
    gl.vertexAttribPointer(GPUProgram.attribLocations.textCoord, 2, gl.FLOAT, false, 32, 24);

    gl.uniformMatrix4fv(GPUProgram.uniformLocation.M, false, M);
    gl.uniformMatrix4fv(GPUProgram.uniformLocation.P, false, P);
    gl.uniformMatrix4fv(GPUProgram.uniformLocation.N, false, N);
}


var timer = 0;
var rotationRad = 0.01;
function renderLoop()
{
    gl.clearColor( 0.1, 0.6, 0.1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);  
    timer++;
 
    mat4.rotate(M, M, rotationRad, [1, 1, 1]);
    mat4.invert(N, M);
    mat4.transpose(N, N);
    gl.uniformMatrix4fv(GPUProgram.uniformLocation.M, false, M);
    gl.uniformMatrix4fv(GPUProgram.uniformLocation.N, false, N);

    gl.bindBuffer(gl.ARRAY_BUFFER, VBO);
    gl.drawElements(gl.TRIANGLES, 6 * 2 * 3, gl.UNSIGNED_SHORT, 0);
}


function main()
{   
    initWebGL();
    renderLoopHandler();   
}

function renderLoopHandler()
{
    renderLoop();


    requestAnimationFrame(renderLoopHandler);
}


window.onload = main;
requestAnimationFrame(renderLoop);