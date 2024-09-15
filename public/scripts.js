const socket = new WebSocket("ws://localhost:8080");

document.addEventListener("DOMContentLoaded", () => {
  const lookupProgress = document.getElementById("lookupProgress");
  const lookupProgressText = document.getElementById("lookupProgressText");
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === "txtLookupProgress") {
      const progress = message.progress;
      lookupProgress.style.width = ` ${(33.33 + progress / 3).toFixed(2)}%`;
      lookupProgressText.textContent = `${(33.33 + progress / 3).toFixed(
        2
      )}% Lookup Completed`;
    }

    if (message.type === "domainParsingProgress") {
      const progress = message.progress;
      lookupProgress.style.width = `${(66.66 + progress / 3).toFixed(2)}%`;
      lookupProgressText.textContent = `${(66.66 + progress / 3).toFixed(
        2
      )}% Domain Parsing Completed`;
    }
  };
  const searchBtn = document.getElementById("search-btn");
  const resultsBody = document.getElementById("results-body");
  const paginationControls = document.getElementById("pagination-controls");
  const searchKeyword = document.getElementById("search-keyword");
  let currentPage = 1;
  let totalPages = 1;
  document
    .getElementById("uploadForm")
    .addEventListener("submit", function (e) {
      e.preventDefault();

      const file = document.getElementById("fileInput").files[0];
      const chunkSize = 2 * 1024 * 1024; // 2MB per chunk
      const totalChunks = Math.ceil(file.size / chunkSize);
      let currentChunk = 0;

      function uploadChunk(start) {
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("chunkIndex", currentChunk);
        formData.append("totalChunks", totalChunks);
        formData.append("fileName", file.name);

        fetch("/upload-chunk", {
          method: "POST",
          body: formData,
        })
          .then((response) => response.text())
          .then((data) => {
            console.log(
              `Chunk ${currentChunk + 1} of ${totalChunks} uploaded.`
            );
            const progress = ((currentChunk + 1) / totalChunks) * 100;
            lookupProgress.style.width = `${(progress / 3).toFixed(2)}%`;
            lookupProgressText.textContent = `${Math.round(
              (progress / 3).toFixed(2)
            )}% Uploading Completed`;

            currentChunk++;

            if (currentChunk < totalChunks) {
              uploadChunk(start + chunkSize);
            } else {
              lookupProgress.style.width = `100%`;
              lookupProgressText.textContent = `Completed!`;
            }
          })
          .catch((error) => console.error("Error:", error));
      }

      uploadChunk(0); 
    });

  function fetchResults(page) {
    const keyword = searchKeyword.value.trim();

    if (keyword === "") {
      resultsBody.innerHTML =
        "<tr><td colspan='2'>Please enter a keyword to search.</td></tr>";
      paginationControls.innerHTML = "";
      return;
    }

    fetch(
      `/search?keyword=${encodeURIComponent(keyword)}&page=${page}&limit=10`
    )
      .then((response) => response.json())
      .then((data) => {
        const { results, totalResults, totalPages: pages } = data;
        totalPages = pages;

        if (results.length === 0) {
          resultsBody.innerHTML =
            "<tr><td colspan='2'>No results found.</td></tr>";
        } else {
          resultsBody.innerHTML = results
            .map(
              (item) =>
                `<tr><td>${item.domain_name}</td><td>${item.txt_record}</td></tr>`
            )
            .join("");
        }

        updatePaginationControls();
      })
      .catch((error) => {
        console.error("Error:", error);
        resultsBody.innerHTML = "<tr><td colspan='2'>Search failed!</td></tr>";
        paginationControls.innerHTML = "";
      });
  }

  function updatePaginationControls() {
    if (totalPages <= 1) {
      paginationControls.innerHTML = "";
      return;
    }

    let paginationHtml = "";

    if (currentPage > 1) {
      paginationHtml += `<button class="pagination-btn" data-page="${
        currentPage - 1
      }">Previous</button>`;
    }

    for (let page = 1; page <= totalPages; page++) {
      paginationHtml += `<button class="pagination-btn ${
        page === currentPage ? "active" : ""
      }" data-page="${page}">${page}</button>`;
    }

    if (currentPage < totalPages) {
      paginationHtml += `<button class="pagination-btn" data-page="${
        currentPage + 1
      }">Next</button>`;
    }

    paginationControls.innerHTML = paginationHtml;
  }

  searchBtn.addEventListener("click", () => {
    currentPage = 1; 
    fetchResults(currentPage);
  });

  paginationControls.addEventListener("click", (e) => {
    if (e.target.classList.contains("pagination-btn")) {
      const page = parseInt(e.target.getAttribute("data-page"), 10);
      if (page !== currentPage) {
        currentPage = page;
        fetchResults(currentPage);
      }
    }
  });
});
