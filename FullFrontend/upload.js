/* =========================
   NAVIGATION
========================= */
const cancelButton = document.getElementById("cancel-button");
const logoLink = document.getElementById("logo-link");
const uploadButton = document.getElementById("upload-button");

if (cancelButton) {
  cancelButton.addEventListener("click", () => {
    window.location.href = "Dashboard.html";
  });
}

if (logoLink) {
  logoLink.addEventListener("click", () => {
    window.location.href = "Dashboard.html";
  });
}

if (uploadButton && !document.getElementById("file-input")) {
  uploadButton.addEventListener("click", () => {
    window.location.href = "Upload.html";
  });
}

/* =========================
   LOGOUT
========================= */
const logoutButton = document.getElementById("logout-button");

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href = "Login.html";
  });
}

/* =========================
   UPLOAD PAGE FUNCTIONALITY
========================= */
const fileInput = document.getElementById("file-input");
const browseLink = document.getElementById("browse-link");
const fileNameDisplay = document.getElementById("file-name");
const uploadBtn = document.getElementById("upload-button");

const maximumFileSize = 5242880; // 5MB
const blockedExtensions = [".exe", ".bat", ".cmd", ".zip", ".7z", ".rar", ".pup"];

// Show selected file name
if (fileInput && fileNameDisplay) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
      fileNameDisplay.textContent = fileInput.files[0].name;
    }
  });
}

// Trigger file picker
if (browseLink && fileInput) {
  browseLink.addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.click();
  });
}

// Upload file
if (uploadBtn && fileInput) {
  uploadBtn.addEventListener("click", async () => {
    const file = fileInput.files[0];

    if (!file) {
      alert("Please select a file first.");
      return;
    }

    if (file.size > maximumFileSize) {
      alert("This file is too large, the maximum file size is 1GB.");
      return;
    }

    if (blockedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      alert("This file type is not allowed.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Please login first.");
      window.location.href = "Login.html";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("https://securedrop-production.up.railway.app/api/files/upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        alert("File uploaded successfully!");
        window.location.href = "Dashboard.html";
      } else {
        alert(data.message || "Upload failed");
      }
    } catch (error) {
      alert("Server error during upload.");
    }
  });
}

/* =========================
   DASHBOARD FUNCTIONALITY
========================= */
const tableBody = document.querySelector(".file-table tbody");

if (tableBody) {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Login.html";
  } else {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const adminLink = document.getElementById("admin-link");
    if (adminLink && payload.role !== "admin") {
      adminLink.style.display = "none";
    }
    loadFiles();
  }
}

async function loadFiles() {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "Login.html";
    return;
  }

  try {
    const response = await fetch("https://securedrop-production.up.railway.app/api/files", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!response.ok) {
      alert("Failed to load files.");
      return;
    }

    const files = await response.json();
    tableBody.innerHTML = "";

    if (files.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center;">
            No files uploaded yet.
          </td>
        </tr>
      `;
      return;
    }

    files.forEach(file => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${file.originalName}</td>
        <td>${formatFileSize(file.size)}</td>
        <td>${new Date(file.createdAt).toLocaleString()}</td>
        <td class="actions">
          <button class="icon-button download-btn" data-id="${file._id}" data-name="${file.originalName}">
            <img src="download_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Download" width="24" height="24">
          </button>
          <button class="icon-button delete-btn" data-id="${file._id}">
            <img src="delete_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg" alt="Delete" width="24" height="24">
          </button>
        </td>
      `;
      tableBody.appendChild(row);
    });

    attachFileActions();
  } catch (error) {
    alert("Error loading files.");
  }
}

/* =========================
   ATTACH FILE ACTIONS
========================= */
function attachFileActions() {
  const token = localStorage.getItem("token");

  document.querySelectorAll(".download-btn").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.id;
      const filename = button.dataset.name;

      const response = await fetch(`https://securedrop-production.up.railway.app/api/files/${id}`, {
        headers: { Authorization: "Bearer " + token }
      });

      if (!response.ok) {
        alert("Download failed");
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    };
  });

  document.querySelectorAll(".delete-btn").forEach(button => {
    button.onclick = async () => {
      const id = button.dataset.id;
      if (!confirm("Are you sure you want to delete this file?")) return;

      const response = await fetch(`https://securedrop-production.up.railway.app/api/files/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + token }
      });

      if (response.ok) {
        loadFiles();
      } else {
        alert("Delete failed");
      }
    };
  });
}

/* =========================
   FORMAT FILE SIZE
========================= */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
