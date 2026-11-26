const board = document.querySelector(".board");
const zoom = document.querySelector(".zoom");

if (typeof zoom.showModal === "function") {
  const content = zoom.querySelector(".zoom-content");
  const closeButton = zoom.querySelector(".close-zoom");
  const projects = new Map(
    [...board.querySelectorAll(".project")].map((project) => {
      project.querySelector(".tile").setAttribute("aria-haspopup", "dialog");
      return ["#" + project.id, project];
    }),
  );
  let currentProject;

  function syncProject() {
    const project = projects.get(location.hash);
    if (project === currentProject) return;

    const previousProject = currentProject;
    if (previousProject) {
      const details = content.querySelector(".project-details");
      details.querySelector("video")?.pause();
      previousProject.append(details);
    }
    currentProject = project;

    if (!project) {
      zoom.close();
      previousProject.querySelector(".tile").focus({ preventScroll: true });
      return;
    }

    const details = project.querySelector(".project-details");
    zoom.style.setProperty("--project-color", getComputedStyle(project).getPropertyValue("--project-color"));
    content.append(details);
    zoom.setAttribute("aria-labelledby", details.getAttribute("aria-labelledby"));
    if (!zoom.open) zoom.showModal();
    zoom.scrollTop = 0;
    closeButton.focus({ preventScroll: true });
  }

  function closeProject() {
    if (history.state?.labProject) {
      history.back();
    } else {
      history.replaceState(null, "", location.pathname + location.search);
      syncProject();
    }
  }

  board.addEventListener("click", (event) => {
    const tile = event.target.closest(".tile");
    if (!tile || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    history.pushState({ labProject: true }, "", tile.hash);
    syncProject();
  });

  closeButton.addEventListener("click", closeProject);
  zoom.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeProject();
  });
  zoom.addEventListener("click", (event) => {
    if (event.target !== zoom) return;
    const { top, right, bottom, left } = zoom.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
      closeProject();
    }
  });

  document.documentElement.classList.add("with-dialog");
  window.addEventListener("hashchange", syncProject);
  syncProject();
}
