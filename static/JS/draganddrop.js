const container = document.getElementById("charts-container");
new Sortable(container, {
  animation: 150,
  ghostClass: "sortable-ghost",
  onStart: function () {
    const chartContainers = document.querySelectorAll(".chart-container");
    chartContainers.forEach((container) => {
      container.classList.add("highlight");
    });
  },
  onEnd: function () {
    const chartContainers = document.querySelectorAll(".chart-container");
    chartContainers.forEach((container) => {
      container.classList.remove("highlight");
    });
  },
});

container.addEventListener("click", function (event) {
  if (event.target.closest(".chart-container")) {
    const chartContainers = document.querySelectorAll(".chart-container");
    chartContainers.forEach((container) => {
      container.classList.remove("selected");
    });
    event.target.closest(".chart-container").classList.add("selected");
  }
});
