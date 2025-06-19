<?php
header('Content-Type: application/json');

/**
 * Handle ComfyUI image generation requests
 */

// Validate request
if (!isset($_POST['prompt'])) {
    echo json_encode(['success' => false, 'error' => 'No prompt provided']);
    exit;
}

$prompt = $_POST['prompt'];
$comfyuiApiUrl = 'https://YOUR_COMFY_UI_API_ENDPOINT/prompt';

// Prepare the generation workflow
$workflow = [
    "prompt" => [
        "3" => [
            "inputs" => [
                "seed" => rand(1, 999999999),
                "steps" => 20,
                "cfg" => 8,
                "sampler_name" => "euler",
                "scheduler" => "normal",
                "denoise" => 1,
                "model" => ["4", 0],
                "positive" => ["6", 0],
                "negative" => ["7", 0],
                "latent_image" => ["5", 0]
            ],
            "class_type" => "KSampler"
        ],
        "4" => [
            "inputs" => [
                "ckpt_name" => "realisticVisionV51_v51VAE.safetensors"
            ],
            "class_type" => "CheckpointLoaderSimple"
        ],
        "5" => [
            "inputs" => [
                "width" => 512,
                "height" => 512,
                "batch_size" => 1
            ],
            "class_type" => "EmptyLatentImage"
        ],
        "6" => [
            "inputs" => [
                "text" => $prompt,
                "clip" => ["4", 1]
            ],
            "class_type" => "CLIPTextEncode"
        ],
        "7" => [
            "inputs" => [
                "text" => "blurry, low quality, distorted",
                "clip" => ["4", 1]
            ],
            "class_type" => "CLIPTextEncode"
        ],
        "8" => [
            "inputs" => [
                "samples" => ["3", 0],
                "vae" => ["4", 2]
            ],
            "class_type" => "VAEDecode"
        ],
        "12" => [
            "inputs" => [
                "format" => "PNG",
                "images" => ["8", 0]
            ],
            "class_type" => "ETN_SendImageWebSocket"
        ]
    ]
];

// Send request to ComfyUI API
$ch = curl_init($comfyuiApiUrl);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($workflow),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_TIMEOUT => 30
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

// Handle response
if ($httpCode !== 200) {
    echo json_encode([
        'success' => false,
        'error' => 'ComfyUI API error: ' . ($response ?: $curlError)
    ]);
    exit;
}

$responseData = json_decode($response, true);
if (!$responseData) {
    echo json_encode([
        'success' => false,
        'error' => 'Invalid response from ComfyUI'
    ]);
    exit;
}

// Return success - image will come via WebSocket
echo json_encode([
    'success' => true,
    'message' => 'Generation started. Image will arrive via WebSocket.'
]);
?>
