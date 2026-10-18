const loginPanel = document.querySelector("#login-panel");
const dashboard = document.querySelector("#dashboard");
const setupNotice = document.querySelector("#setup-notice");
const loginMessage = document.querySelector("#login-message");
const dashboardMessage = document.querySelector("#dashboard-message");
const uploadMessage = document.querySelector("#upload-message");
const signOutButton = document.querySelector("#sign-out");

function setMessage(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("error", isError);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function showDashboard(isVisible) {
  loginPanel.hidden = isVisible;
  dashboard.hidden = !isVisible;
  signOutButton.hidden = !isVisible;
}

async function startAdmin() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import("./supabase-config.js");
  if (!SUPABASE_URL) {
    setupNotice.hidden = false;
    setupNotice.textContent = "Add your Supabase Project URL to js/supabase-config.js to enable sign-in. Never add a service_role key here.";
    document.querySelector("#login-form button").disabled = true;
    return;
  }

  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function loadDashboard() {
    setMessage(dashboardMessage, "");
    const [
      { data: projects, error: projectsError },
      { data: assets, error: assetsError },
      { data: messages, error: messagesError },
    ] = await Promise.all([
      supabase.from("compass_projects").select("*").order("display_order"),
      supabase.from("compass_assets").select("*").order("created_at", { ascending: false }),
      supabase.from("compass_contact_messages").select("*").order("created_at", { ascending: false }),
    ]);
    if (projectsError) throw projectsError;
    if (assetsError) throw assetsError;
    if (messagesError) throw messagesError;
    renderProjects(projects || []);
    renderAssets(assets || []);
    renderContactMessages(messages || []);
    renderProjectOptions(projects || []);
  }

  function renderProjects(projects) {
    const list = document.querySelector("#project-list");
    if (!projects.length) {
      list.innerHTML = '<p class="loading-message">No projects found. Run supabase/schema.sql in the Supabase SQL Editor.</p>';
      return;
    }
    list.innerHTML = projects.map((project) => `
      <form class="project-card" data-project-form="${escapeHtml(project.slug)}">
        <h3>${escapeHtml(project.name)}</h3>
        <label>Neighborhood<input name="neighborhood" maxlength="100" value="${escapeHtml(project.neighborhood)}" required></label>
        <div class="project-card-row">
          <label>Construction status<select name="status"><option value="delivered" ${project.status === "delivered" ? "selected" : ""}>Delivered</option><option value="under_construction" ${project.status === "under_construction" ? "selected" : ""}>Under construction</option></select></label>
          <label>Sort order<input name="display_order" type="number" min="0" step="1" value="${Number(project.display_order)}" required></label>
        </div>
        <label>Public description<textarea name="summary" maxlength="500" required>${escapeHtml(project.summary)}</textarea></label>
        <label class="check-field"><input name="is_published" type="checkbox" ${project.is_published ? "checked" : ""}> Published on the public site</label>
        <button class="primary-button" type="submit">Save changes <span>↗</span></button>
      </form>`).join("");
  }

  function renderProjectOptions(projects) {
    const select = document.querySelector("#media-project");
    select.innerHTML = '<option value="">Choose project</option>';
    projects.forEach((project) => {
      const option = document.createElement("option");
      option.value = project.slug;
      option.textContent = project.name;
      select.append(option);
    });
  }

  function renderAssets(assets) {
    const list = document.querySelector("#asset-list");
    if (!assets.length) {
      list.innerHTML = '<p class="loading-message">No additional media uploaded yet.</p>';
      return;
    }
    list.innerHTML = assets.map((asset) => `
      <div class="asset-row" data-asset-id="${escapeHtml(asset.id)}">
        <span><strong>${escapeHtml(asset.title)}</strong><small>${escapeHtml(asset.project_slug)} · ${escapeHtml(asset.kind)} · ${asset.is_public ? "Public" : "Hidden"}</small></span>
        <a href="${escapeHtml(supabase.storage.from("compass-media").getPublicUrl(asset.storage_path).data.publicUrl)}" target="_blank" rel="noreferrer">Open ↗</a>
        <button type="button" data-remove-asset="${escapeHtml(asset.id)}">Remove</button>
      </div>`).join("");
  }

  function renderContactMessages(messages) {
    const list = document.querySelector("#contact-message-list");
    if (!messages.length) {
      list.innerHTML = '<p class="loading-message">No messages received yet.</p>';
      return;
    }
    list.innerHTML = messages.map((message) => {
      const date = new Date(message.created_at);
      const dateLabel = Number.isNaN(date.getTime()) ? message.created_at : date.toLocaleString();
      return `
        <article class="contact-message-row">
          <div class="contact-message-heading"><strong>${escapeHtml(message.name)}</strong><time datetime="${escapeHtml(message.created_at)}">${escapeHtml(dateLabel)}</time></div>
          <div class="contact-message-details"><a href="mailto:${escapeHtml(message.email)}">${escapeHtml(message.email)}</a>${message.phone ? `<span>${escapeHtml(message.phone)}</span>` : ""}${message.project ? `<span>Project: ${escapeHtml(message.project)}</span>` : ""}</div>
          <p>${escapeHtml(message.message)}</p>
        </article>`;
    }).join("");
  }

  async function enterDashboard(session) {
    if (!session) {
      showDashboard(false);
      return;
    }
    const { data, error } = await supabase.from("compass_admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      await supabase.auth.signOut();
      showDashboard(false);
      setMessage(loginMessage, "This account is not approved as the Compass owner. Ask the project owner to add it to compass_admins.", true);
      return;
    }
    showDashboard(true);
    try {
      await loadDashboard();
    } catch (error) {
      setMessage(dashboardMessage, `Admin data could not be loaded: ${error.message}`, true);
    }
  }

  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    setMessage(loginMessage, "Signing in…");
    const form = new FormData(event.currentTarget);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password"),
    });
    if (error) {
      setMessage(loginMessage, error.message, true);
      return;
    }
    try {
      await enterDashboard(data.session);
    } catch (error) {
      setMessage(loginMessage, error.message, true);
    }
  });

  signOutButton.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(dashboardMessage, error.message, true);
      return;
    }
    showDashboard(false);
  });

  document.querySelector("#project-list").addEventListener("submit", async (event) => {
    if (!event.target.matches("[data-project-form]")) return;
    event.preventDefault();
    const form = event.target;
    const values = new FormData(form);
    const { error } = await supabase.from("compass_projects").update({
      neighborhood: values.get("neighborhood").trim(),
      status: values.get("status"),
      display_order: Number(values.get("display_order")),
      summary: values.get("summary").trim(),
      is_published: values.get("is_published") === "on",
      updated_at: new Date().toISOString(),
    }).eq("slug", form.dataset.projectForm);
    if (error) {
      setMessage(dashboardMessage, `Could not save ${form.dataset.projectForm}: ${error.message}`, true);
      return;
    }
    setMessage(dashboardMessage, `${form.dataset.projectForm} saved. The public site will use the updated information.`);
  });

  document.querySelector("#media-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const file = values.get("file");
    const title = values.get("title").trim();
    const projectSlug = values.get("project_slug");
    const kind = values.get("kind");
    const altText = values.get("alt_text").trim();
    if (!(file instanceof File) || !file.size) {
      setMessage(uploadMessage, "Choose a file to upload.", true);
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setMessage(uploadMessage, "This file is larger than the 100 MB upload limit.", true);
      return;
    }
    const safeName = file.name.replace(/[^\w.-]+/g, "-");
    const storagePath = `${projectSlug}/${crypto.randomUUID()}-${safeName}`;
    setMessage(uploadMessage, "Uploading…");
    const { error: uploadError } = await supabase.storage.from("compass-media").upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      setMessage(uploadMessage, `Upload failed: ${uploadError.message}`, true);
      return;
    }
    const { error: insertError } = await supabase.from("compass_assets").insert({
      project_slug: projectSlug,
      kind,
      title,
      alt_text: altText,
      storage_path: storagePath,
      is_public: values.get("is_public") === "on",
    });
    if (insertError) {
      const { error: cleanupError } = await supabase.storage.from("compass-media").remove([storagePath]);
      const cleanupMessage = cleanupError ? ` The uploaded file also needs cleanup: ${cleanupError.message}` : "";
      setMessage(uploadMessage, `File uploaded, but its record could not be saved: ${insertError.message}.${cleanupMessage}`, true);
      return;
    }
    form.reset();
    form.querySelector('[name="is_public"]').checked = true;
    setMessage(uploadMessage, "Media uploaded.");
    try {
      await loadDashboard();
    } catch (error) {
      setMessage(uploadMessage, `Media uploaded, but the list could not refresh: ${error.message}`, true);
    }
  });

  document.querySelector("#asset-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-remove-asset]");
    if (!button) return;
    const asset = button.closest("[data-asset-id]");
    if (!window.confirm("Remove this media item from the site and delete its stored file?")) return;
    const { data: record, error: selectError } = await supabase.from("compass_assets").select("storage_path").eq("id", button.dataset.removeAsset).single();
    if (selectError) {
      setMessage(dashboardMessage, `Could not load media details: ${selectError.message}`, true);
      return;
    }
    const { error: deleteError } = await supabase.from("compass_assets").delete().eq("id", button.dataset.removeAsset);
    if (deleteError) {
      setMessage(dashboardMessage, `Could not remove media: ${deleteError.message}`, true);
      return;
    }
    const { error: storageError } = await supabase.storage.from("compass-media").remove([record.storage_path]);
    if (storageError) {
      asset.remove();
      setMessage(dashboardMessage, `Media was removed from the site, but its stored file could not be deleted: ${storageError.message}`, true);
      return;
    }
    asset.remove();
    setMessage(dashboardMessage, "Media removed.");
  });

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  await enterDashboard(sessionData.session);
  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) showDashboard(false);
  });
}

startAdmin().catch((error) => {
  setupNotice.hidden = false;
  setupNotice.textContent = `Admin setup could not start: ${error.message}`;
});
