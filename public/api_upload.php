<?php
// =============================================
// MULTIPART FILE UPLOAD API FOR REACT FRONTEND
// =============================================

// Allow cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json; charset=utf-8");

// Handle preflight (OPTIONS) requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Utility function for JSON response
function respond($status, $message, $data = null) {
    echo json_encode(["status" => $status, "message" => $message, "data" => $data]);
    exit;
}

// Only allow POST requests for uploads
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond("error", "Only POST requests are allowed.");
}

// Configuration
$uploadDir = __DIR__ . '/uploads/';
$maxFileSize = 50 * 1024 * 1024; // 50MB
$allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'mp4', 'avi', 'mov', 'webm', 'zip', 'rar'];
$allowedMimeTypes = [
    'image/jpeg', 'image/png', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'video/mp4', 'video/x-msvideo', 'video/quicktime', 'video/webm',
    'application/zip', 'application/x-rar-compressed'
];

// Create uploads directory if it doesn't exist
if (!is_dir($uploadDir)) {
    if (!mkdir($uploadDir, 0755, true)) {
        respond("error", "Failed to create uploads directory.");
    }
}

// Check if files were uploaded
if (empty($_FILES)) {
    respond("error", "No files provided.");
}

$uploadedFiles = [];
$errors = [];

// Process each uploaded file
foreach ($_FILES as $fieldName => $fileData) {
    // Handle both single and multiple files
    $files = is_array($fileData['name']) ? $fileData : [$fileData];
    
    if (!is_array($files['name'])) {
        $files = [
            'name' => [$files['name']],
            'type' => [$files['type']],
            'tmp_name' => [$files['tmp_name']],
            'error' => [$files['error']],
            'size' => [$files['size']]
        ];
    }
    
    for ($i = 0; $i < count($files['name']); $i++) {
        $fileName = trim($files['name'][$i]);
        $fileTmpName = $files['tmp_name'][$i];
        $fileError = $files['error'][$i];
        $fileSize = $files['size'][$i];
        $fileMimeType = $files['type'][$i];
        
        // Skip empty files
        if (empty($fileName)) {
            continue;
        }
        
        // Check for upload errors
        if ($fileError !== UPLOAD_ERR_OK) {
            $errorMessages = [
                UPLOAD_ERR_INI_SIZE => "File exceeds upload_max_filesize directive",
                UPLOAD_ERR_FORM_SIZE => "File exceeds MAX_FILE_SIZE directive",
                UPLOAD_ERR_PARTIAL => "File was only partially uploaded",
                UPLOAD_ERR_NO_FILE => "No file was uploaded",
                UPLOAD_ERR_NO_TMP_DIR => "Missing temporary folder",
                UPLOAD_ERR_CANT_WRITE => "Failed to write file to disk",
                UPLOAD_ERR_EXTENSION => "PHP extension blocked the file upload"
            ];
            $errors[] = "$fileName: " . ($errorMessages[$fileError] ?? "Unknown error");
            continue;
        }
        
        // Validate file size
        if ($fileSize > $maxFileSize) {
            $errors[] = "$fileName: File size exceeds 50MB limit";
            continue;
        }
        
        // Validate file extension
        $fileExt = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
        if (!in_array($fileExt, $allowedExtensions)) {
            $errors[] = "$fileName: File type not allowed (.$fileExt)";
            continue;
        }
        
        // Validate MIME type
        if (!in_array($fileMimeType, $allowedMimeTypes)) {
            $errors[] = "$fileName: Invalid MIME type detected";
            continue;
        }
        
        // Generate unique filename
        $uniqueFileName = uniqid('file_') . '_' . time() . '.' . $fileExt;
        $uploadPath = $uploadDir . $uniqueFileName;
        
        // Move uploaded file
        if (!move_uploaded_file($fileTmpName, $uploadPath)) {
            $errors[] = "$fileName: Failed to save file";
            continue;
        }
        
        // Set proper permissions
        chmod($uploadPath, 0644);
        
        // Build file URL
        $fileUrl = rtrim(dirname($_SERVER['PHP_SELF']), '/') . '/uploads/' . $uniqueFileName;
        
        $uploadedFiles[] = [
            'originalName' => $fileName,
            'fileName' => $uniqueFileName,
            'url' => $fileUrl,
            'size' => $fileSize,
            'mimeType' => $fileMimeType,
            'uploadedAt' => date('Y-m-d H:i:s')
        ];
    }
}

// Prepare response
if (empty($uploadedFiles) && !empty($errors)) {
    respond("error", "File upload failed. " . implode("; ", $errors));
} else {
    $message = "Upload completed";
    if (!empty($errors)) {
        $message .= " with " . count($errors) . " error(s)";
    }
    respond("success", $message, [
        "uploaded" => $uploadedFiles,
        "errors" => $errors,
        "count" => count($uploadedFiles)
    ]);
}
?>
