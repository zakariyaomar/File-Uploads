import { useRef, useState } from "react";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);

function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

export default function ImageUploader() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState("");
  const [error, setError] = useState("");

  const clearSelection = () => {
    setFile(null);
    setPreviewUrl("");
    setUploadedUrl("");
    setProgress(0);
  };

  const validateAndSetFile = (selectedFile) => {
    setError("");

    if (!ALLOWED_MIME_TYPES.has(selectedFile.type)) {
      clearSelection();
      setError("Invalid file type. Only JPG, PNG, and GIF are allowed.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      clearSelection();
      setError("File too large. Maximum size is 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFile(selectedFile);
      setPreviewUrl(reader.result);
      setUploadedUrl("");
      setProgress(0);
    };
    reader.onerror = () => setError("Unable to create an image preview.");
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragOver(false);
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  const uploadFile = () => {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setError("");
    setUploadedUrl("");
    setProgress(0);

    const formData = new FormData();
    formData.append("image", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/upload");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onerror = () => {
      setError("Network error while uploading the image.");
      setIsUploading(false);
    };
    request.onload = () => {
      setIsUploading(false);

      let response;
      try {
        response = JSON.parse(request.responseText);
      } catch {
        setError("The server returned an invalid response.");
        return;
      }

      if (request.status >= 200 && request.status < 300) {
        setUploadedUrl(response.file.url);
        setProgress(100);
        return;
      }

      setError(response.error || "Failed to upload the image.");
    };
    request.send(formData);
  };

  return (
    <section>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif"
        hidden
        onChange={(event) => {
          const selectedFile = event.target.files[0];
          if (selectedFile) {
            validateAndSetFile(selectedFile);
          }
          event.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        style={{
          background: isDragOver ? "#eff6ff" : "#fafafa",
          border: `2px dashed ${isDragOver ? "#2563eb" : "#9ca3af"}`,
          borderRadius: "8px",
          cursor: "pointer",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        Drag and drop an image here, or click to browse
      </div>

      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}

      {file && (
        <div>
          <img
            src={previewUrl}
            alt={`Preview of ${file.name}`}
            style={{ display: "block", marginTop: "1rem", maxHeight: "250px", maxWidth: "100%" }}
          />
          <p>{file.name} - {formatFileSize(file.size)}</p>
          <button type="button" onClick={uploadFile} disabled={isUploading}>
            {isUploading ? `Uploading... ${progress}%` : "Upload"}
          </button>
        </div>
      )}

      {uploadedUrl && (
        <div>
          <p>
            Upload complete: <a href={uploadedUrl} target="_blank" rel="noreferrer">{uploadedUrl}</a>
          </p>
          <img
            src={uploadedUrl}
            alt={`Uploaded ${file?.name || "image"}`}
            style={{ maxHeight: "250px", maxWidth: "100%" }}
          />
        </div>
      )}
    </section>
  );
}
