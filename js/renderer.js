import { shaderSource } from './shaders.js';

// 1. DADES DELS VÈRTEXS (Posició X,Y + Color R,G,B)
// Dades del Triangle pur (3 vèrtexs)
const triangleVertices = new Float32Array([
     0.0, 0.5, 1.0, 0.0, 0.0, // Sup (Vermell)
    -0.5, -0.5, 0.0, 1.0, 0.0, // Inf Esquerre (Verd)
     0.5, -0.5, 0.0, 0.0, 1.0 // Inf Dret (Blau)
]);

// Dades del Quad (Només 4 vèrtexs únics en comptes de 6!)
const quadVertices = new Float32Array([
    -0.5, 0.5, 1.0, 0.0, 0.0, // 0: Sup Esquerre (Vermell)
     0.5, 0.5, 0.0, 1.0, 0.0, // 1: Sup Dret (Verd)
    -0.5, -0.5, 0.0, 0.0, 1.0, // 2: Inf Esquerre (Blau)
     0.5, -0.5, 1.0, 1.0, 0.0 // 3: Inf Dret (Groc)
]);

// Els Índexs per connectar els 4 vèrtexs en 2 triangles (CCW - Counter Clockwise)
const quadIndices = new Uint16Array([
    0, 2, 1, // Primer triangle
    1, 2, 3 // Segon triangle
]);

async function run() {
    if (!navigator.gpu) {
        document.getElementById('canvas-container').innerHTML = "<p style='color:red;'>El teu navegador no suporta WebGPU.</p>";
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const canvas = document.getElementById("webgpu-canvas");
    const context = canvas.getContext("webgpu");
    const format = navigator.gpu.getPreferredCanvasFormat();
    
    canvas.width = 600;
    canvas.height = 600;

    context.configure({ device, format, alphaMode: "opaque" });

    // 2. CREACIÓ DE BUFFERS A LA GPU
    const createBuffer = (data, usage) => {
        const buffer = device.createBuffer({
            size: data.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
    };

    const triangleVertexBuffer = createBuffer(triangleVertices, GPUBufferUsage.VERTEX);
    const quadVertexBuffer = createBuffer(quadVertices, GPUBufferUsage.VERTEX);
    const quadIndexBuffer = createBuffer(quadIndices, GPUBufferUsage.INDEX);

    // 3. CANONADA DE RENDER (Pipeline)
    const shaderModule = device.createShaderModule({ code: shaderSource });
    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
            buffers: [{
                arrayStride: 20, // 5 floats * 4 bytes
                attributes: [
                    { shaderLocation: 0, offset: 0, format: "float32x2" }, // posició
                    { shaderLocation: 1, offset: 8, format: "float32x3" } // color
                ]
            }]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [{ format }]
        },
        primitive: { topology: "triangle-list" }
    });

    // 4. LÒGICA D'INTERFACIE I RENDER LOOP
    const dataDisplay = document.getElementById("data-display");
    let currentMode = "triangle";

    function updateUI() {
        if (currentMode === "triangle") {
            dataDisplay.innerText = `// Posicions (X,Y) i Colors (R,G,B)\nVertex Count: 3\nVertices = [\n 0.0, 0.5, [Vermell],\n -0.5, -0.5, [Verd],\n 0.5, -0.5, [Blau]\n];\n\n// Sense Index Buffer (glDrawArrays)`;
        } else {
            dataDisplay.innerText = `Vertex Count: 4 (Únics)\nVertices = [ ...4 vèrtexs... ];\n\nIndex Count: 6\nIndices = [\n 0, 2, 1, // Tri 1\n 1, 2, 3 // Tri 2\n];\n\n// Amb Index Buffer (glDrawElements)`;
        }
    }

    document.getElementsByName("render-mode").forEach(radio => {
        radio.addEventListener("change", (e) => {
            currentMode = e.target.value;
            updateUI();
            render();
        });
    });

    function render() {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
        
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                loadOp: "clear",
                storeOp: "store"
            }]
        });

        renderPass.setPipeline(pipeline);

        if (currentMode === "triangle") {
            renderPass.setVertexBuffer(0, triangleVertexBuffer);
            renderPass.draw(3); // glDrawArrays equivalent
        } else {
            renderPass.setVertexBuffer(0, quadVertexBuffer);
            renderPass.setIndexBuffer(quadIndexBuffer, "uint16");
            renderPass.drawIndexed(6); // glDrawElements equivalent
        }

        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
    }

    // Inicialització inicial
    updateUI();
    render();
}

run();
