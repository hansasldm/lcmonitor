<?php
// Prevent CORS issues (just in case, though it's same-origin)
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: *");
header("Access-Control-Allow-Methods: *");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Extract path directly from the raw query string to preserve all parameters exactly as they are
$queryString = $_SERVER['QUERY_STRING'] ?? '';
$path = '';
if (preg_match('/path=([^&]+)/', $queryString, $matches)) {
    $path = urldecode($matches[1]);
    // Append any other query parameters that were separated by &
    $extraQuery = preg_replace('/path=[^&]+&?/', '', $queryString);
    if (!empty($extraQuery)) {
        // If the path already has a ? (e.g. path=history?days=14)
        if (strpos($path, '?') !== false) {
            $path .= '&' . $extraQuery;
        } else {
            $path .= '?' . $extraQuery;
        }
    }
}

if (empty($path)) {
    http_response_code(400);
    echo json_encode(["error" => "Path is required"]);
    exit;
}

$supabaseUrl = "https://cuawkttwzfpjtqwjaybu.supabase.co/functions/v1/" . $path;

// Get all incoming headers
$headers = [];
foreach (getallheaders() as $name => $value) {
    if (in_array(strtolower($name), ['authorization', 'content-type', 'apikey', 'x-client-info'])) {
        $headers[] = "$name: $value";
    }
}

$ch = curl_init($supabaseUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
    $body = file_get_contents('php://input');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);

curl_close($ch);

http_response_code($httpCode);
if ($contentType) {
    header("Content-Type: $contentType");
}
echo $response;
