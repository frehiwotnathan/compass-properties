async function loadPublicProjectData() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("./supabase-config.js");
  if (!SUPABASE_URL) return;

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const [
    { data: projects, error: projectsError },
    { data: assets, error: assetsError },
  ] = await Promise.all([
    supabase.from("compass_projects").select("slug,name,status,summary,is_published").eq("is_published", true).order("display_order"),
    supabase.from("compass_assets").select("project_slug,kind,alt_text,storage_path,is_public,created_at").eq("is_public", true).order("created_at", { ascending: false }),
  ]);
  if (projectsError) throw projectsError;
  if (assetsError) throw assetsError;

  const publicProjects = new Map((projects || []).map((project) => [project.slug, project]));
  publicProjects.forEach((project, slug) => {
    const card = document.querySelector(`[data-project="${slug}"]`);
    if (!card) return;
    const status = card.querySelector(`[data-project-status="${slug}"]`);
    if (status) {
      status.classList.toggle("delivered", project.status === "delivered");
      status.classList.toggle("building", project.status === "under_construction");
      status.querySelector(".status-label").textContent = project.status === "delivered" ? "Delivered" : "Under construction";
    }
    const summary = card.querySelector(`[data-project-summary="${slug}"]`);
    if (summary) summary.textContent = project.summary;
  });

  const getAssetUrl = (path) => supabase.storage.from("compass-media").getPublicUrl(path).data.publicUrl;
  const renders = new Map();
  (assets || []).filter((asset) => asset.kind === "project_render").forEach((asset) => {
    if (!renders.has(asset.project_slug)) renders.set(asset.project_slug, asset);
  });
  renders.forEach((asset, slug) => {
    const project = publicProjects.get(slug);
    const image = document.querySelector(`[data-project-image="${slug}"]`);
    if (project && image) {
      image.src = getAssetUrl(asset.storage_path);
      image.alt = asset.alt_text || `${project.name} project rendering`;
    }
  });
}

loadPublicProjectData().catch((error) => {
  const notice = document.querySelector("#site-data-status");
  if (notice) {
    notice.hidden = false;
    notice.textContent = "Project information could not be refreshed from the admin database. Showing the saved project information.";
  }
  console.error("Could not load Compass Supabase content:", error);
});
